# Размещение Monochrome SPHEREx

Самый простой вариант для текущей архитектуры — **один Docker Web Service на Render**.
Один контейнер содержит собранный React-интерфейс, API и отдельный процесс worker.
SQLite и результаты находятся в общем каталоге: в Free они временные, в отдельном
платном профиле сохраняются на постоянном диске. Redis, PostgreSQL и второй
хост для первого размещения не требуются. Это конфигурация для пилота/небольшой команды;
ограничения открытого доступа описаны ниже.

## Что подготовлено

- `Dockerfile`: Node 24 собирает frontend по lock-файлу; финальный Python 3.13 образ
  содержит зависимости из `uv.lock` и готовую статику. Node/Vite в production не запускаются.
- `spherex.web`: `/` и `/assets` отдают frontend; `/api/v1`, `/health`, `/docs` и
  скачивание артефактов обслуживает прежний API. HTML не кешируется между релизами.
- `spherex.deployment`: запускает один API и один worker, учитывает `PORT`, передаёт
  остановку дочерним процессам. Сбой любого процесса завершает контейнер с ошибкой.
- `render.yaml`: ветка `Site_Deploy`, один экземпляр **Free**, без постоянного диска,
  readiness `/health/ready`. Данные временные; 512 MB RAM могут не хватить для FITS.
- `render.persistent.yaml`: необязательный **платный** профиль, 1 CPU / 2 GB RAM
  (`1c-2g`), диск 10 GB в `/app/data`. Оценка памяти — стартовая рекомендация,
  а не результат нагрузочного теста. Для него явно выберите другой Blueprint path.
- `compose.production.yaml`: тот же сайт для локальной проверки или собственного VPS.
- CI: сборка образа и HTTP-проверка сайта, API, worker и скачивания результатов
  на явно синтетическом провайдере; затем проверка штатной остановки контейнера.

## 1. Исходники в GitHub

Для деплоя используйте ветку `Site_Deploy` репозитория
`Issabek-UN1/Monochrome_Planet-X_and_SPHEREx`. Локальная папка
`Monochrome_Planet-X_and_SPHEREx-Site_Deploy` подключена к ней как отдельный checkout;
перед отправкой проверяйте `git branch --show-current` и `git remote -v`.

Render читает исходники **из GitHub**, а не с диска F:. Подготовленные файлы должны
оказаться в корне нужной ветки: `Dockerfile`, `render.yaml`, `backend/`, `frontend/`,
`packages/`, `pyproject.toml`, `uv.lock` и остальные исходники. Не добавляйте внешнюю
папку `Monochrome_Planet-X_and_SPHEREx-Site_Deploy` как ещё один уровень проекта.
Не загружайте `.env`, `.venv`, `node_modules`, `data`, FITS и кэши.

## 2. Создать сайт на Render

1. Войти в [Render](https://dashboard.render.com/) через GitHub и предоставить доступ
   к `Issabek-UN1/Monochrome_Planet-X_and_SPHEREx`.
2. Выбрать **New → Blueprint**, репозиторий и ветку **`Site_Deploy`**.
3. Убедиться, что найден `render.yaml` в корне и показан один Docker Web Service.
4. Проверить план **Free** и отсутствие disk, затем создать сервис.
   Регион в файле — Frankfurt; при необходимости поменяйте его до создания.
5. Дождаться сборки и зелёного статуса сервиса. Открыть выданный адрес
   `https://<имя-сервиса>.onrender.com`. TLS и поддомен предоставляет Render.

Если Blueprint недоступен, создайте **New → Web Service** с тем же репозиторием:

| Поле | Значение |
| --- | --- |
| Branch | `Site_Deploy` |
| Root Directory | пусто |
| Runtime / Language | Docker |
| Dockerfile Path | `./Dockerfile` |
| Docker Build Context | `.` |
| Docker Command | пусто — используется CMD образа |
| Instance | **Free** |
| Health Check Path | `/health/ready` |
| Disk | не добавлять |
| Auto deploy | выключить на время первого запуска |

Переменные окружения для ручного создания:

```dotenv
SPHEREX_PROVIDER=irsa
SPHEREX_DATA_DIR=/app/data
SPHEREX_CORS_ORIGINS=[]
SPHEREX_MAX_PENDING_JOBS=10
SPHEREX_HTTP_TIMEOUT_SECONDS=120
```

`PORT` задаёт Render. `SPHEREX_STATIC_DIR` уже указан в Dockerfile.
`VITE_API_BASE_URL` оставьте незаданным: сайт и API имеют общий origin.
Отдельный Background Worker в Render создавать не нужно: ему был бы недоступен
локальный диск Web Service. Не включайте несколько экземпляров или autoscaling
для этой SQLite-конфигурации.

## 3. Проверка после размещения

1. `/` открывает Mission Control; вкладки переключаются без dev-сервера.
2. `/health/live` возвращает HTTP 200.
3. `/health/ready` возвращает HTTP 200 и `checks.worker=ok`. HTTP 503 означает,
   что API или heartbeat worker ещё не готовы. Эта проверка не проверяет архив.
4. `/api/v1/capabilities` содержит `provider=irsa`, `synthetic=false`.
5. В Live Explorer выполнить небольшой поиск одного детектора, выбрать один кадр,
   создать cutout и дождаться `succeeded`; открыть PNG и скачать FITS/provenance.
   Это отдельная сетевая проверка IRSA. Ошибка архива остаётся видимой ошибкой.
6. На Free после restart/redeploy/sleep прежние ID и артефакты исчезают — поиск и
   обработку нужно выполнить заново. Только для платного профиля проверьте, что
   прежний ID и артефакты переживают деплой: это проверяет подключение диска.

Для обновления после отправки исходников нажмите **Manual Deploy → Deploy latest commit**.
Автоматический деплой в Blueprint выключен. При желании позднее включите запуск
только после успешных CI checks. С подключённым диском обновление имеет краткий простой.

## Проверка на компьютере и на VPS

Без Docker, из корня проекта после `uv sync --frozen`:

```powershell
cd frontend
npm ci --include=dev
npm run build
cd ..
uv run python -m spherex.deployment
```

Открыть `http://localhost:8000`. `SPHEREX_PROVIDER` по умолчанию — `irsa`,
локальный `.env` имеет приоритет над значениями по умолчанию.
Для офлайн-проверки отдельной временной базы и обоих сервисов:

```powershell
uv run python scripts/smoke_deployment.py
```

С Docker:

```text
docker compose -f compose.production.yaml up --build -d
docker compose -f compose.production.yaml logs -f web
docker compose -f compose.production.yaml down
```

Сайт доступен на `http://127.0.0.1:8000`. Данные сохраняются в именованном томе;
`down -v` удаляет этот том, поэтому для обычной остановки `-v` не используйте.
На VPS поставьте перед loopback-портом Caddy/nginx с HTTPS и ограничениями запросов.
Обычный `docker compose up --build` сохраняет прежнюю схему API + отдельный worker
без раздачи frontend — это конфигурация разработки, а не сайт целиком.

## Другие варианты и ограничения

| Вариант | Когда выбирать |
| --- | --- |
| Render, один Docker Web Service + disk | Простой первый пилот, без администрирования сервера |
| Railway, один Docker service + volume | Аналогичный вариант; выбрать один replica и `/app/data` для volume |
| VPS + Docker Compose + HTTPS proxy | Больше контроля и обязанностей: ОС, TLS, backup, мониторинг |
| Vercel / Netlify / GitHub Pages | Для отдельной статической части; Python API, worker и диск всё равно понадобятся на другом хосте |

Бесплатный Render годится только для краткой пробы: засыпает после 15 минут простоя,
не поддерживает постоянный диск и теряет SQLite/результаты при restart, redeploy или
засыпании. 512 MB памяти могут оказаться недостаточны для обработки FITS. Чтобы
пробовать Free, используйте основной `render.yaml` или Web Service вручную без disk.
`render.persistent.yaml` содержит платный диск и не предназначен для Free.

У приложения пока **нет авторизации, лимита запросов на посетителя и автоматической
очистки данных**. Результаты общие для всех посетителей экземпляра. Ёмкость очереди 10
ограничивает только число активных задач. Перед широким анонимным доступом нужны
внешний контроль доступа/rate limits, контроль свободного диска, политика хранения
и согласованные резервные копии SQLite/артефактов. Не удаляйте базу и каталог активной
задачи во время обработки. Отслеживайте память и диск в панели хостинга.
Для спектрального запроса дополнительно требуется до 384 MiB временного места.

Научные алгоритмы размещением не меняются: стеки/разности одного детектора
не становятся согласованными по длинам волн; недоступность IRSA не включает demo.

Официальные инструкции (проверены 15 ноября 2026):
[Render Docker](https://render.com/docs/docker),
[Blueprint](https://render.com/docs/blueprint-spec),
[compute plans](https://render.com/docs/compute-plans),
[persistent disks](https://render.com/docs/disks),
[Free](https://render.com/docs/free),
[тарифы](https://render.com/pricing),
[Railway volumes](https://docs.railway.com/volumes).
