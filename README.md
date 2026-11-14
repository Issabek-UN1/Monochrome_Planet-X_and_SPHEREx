# Monochrome SPHEREx

Бэкенд инструмента исследования неба для NASA Space Apps 2026, задача
[Planet X and SPHEREx](https://www.spaceappschallenge.org/2026/challenges/planet-x-and-spherex/?tab=details).

**Статус: начальный рабочий MVP.** Поиск в IRSA, обработка FITS и отдельный worker.
Фронтенд подключён к API через Vite proxy. Карусель использует явно помеченные синтетические примеры; реальные запросы выполняются в Sky Explorer.
Это инструмент визуального исследования, а не система подтверждения открытия Planet X.

## Быстрый запуск

Нужны Python 3.12–3.14, [uv](https://docs.astral.sh/uv/getting-started/installation/) и Node.js.
Запускайте команды из корня репозитория.

### Вариант 1 (Windows, в 1 клик):
Дважды кликните по файлу **`start-dashboard.bat`** (или выполните в PowerShell `.\start-dashboard.ps1`).
Скрипт автоматически синхронизирует зависимости, поднимет Backend API (порт 8000), Worker обработки задач, запустит дашборд и откроет его в браузере на [http://localhost:5173](http://localhost:5173).

### Вариант 2 (Git Bash на Windows, Linux или macOS):
```bash
bash start.sh
```
Скрипт подготовит окружение, создаст `.env`, если его ещё нет, запустит API, worker и дашборд и откроет [http://localhost:5173](http://localhost:5173) в браузере. Остановка всех процессов — `Ctrl+C`.
Другие порты: `PORT=8001 FRONTEND_PORT=5174 bash start.sh`; без браузера: `OPEN_BROWSER=0 bash start.sh`.
Для повторного запуска без установки библиотек: `SKIP_SYNC=1 bash start.sh`.

Ручной запуск:

```powershell
uv sync --frozen
Copy-Item .env.example .env
uv run uvicorn spherex.api:app --reload --host 127.0.0.1 --port 8000
```

В другом терминале запустите обработку задач:

```powershell
uv run spherex-worker
```

На macOS/Linux вместо `Copy-Item` используйте `cp`. Активация окружения не требуется.
Swagger: [localhost:8000/docs](http://localhost:8000/docs).
Проверка API: [localhost:8000/health/ready](http://localhost:8000/health/ready).

Пример `.env` включает **синтетический demo**: это позволяет подключать интерфейс без сети.
Для настоящих наблюдений поменяйте `SPHEREX_PROVIDER=irsa` и перезапустите **API и worker**.
Без `.env` по умолчанию используется `irsa`. Провайдер никогда не подменяет реальные данные
демонстрационными при ошибке архива. API и worker должны иметь одинаковые настройки и `data_dir`.

## Запуск фронтенда

Фронтенд реализован на Vite + React + TypeScript + Three.js:

```powershell
cd frontend
npm install
npm run dev
```

Интерфейс откроется на [http://localhost:5173](http://localhost:5173). Включает кинематическую карусель (Auge XP style), 3D небесную сферу SPHEREx, Sky Explorer и 102-полосную лабораторию спектров.

## Что уже работает

- Поиск наблюдений по RA/Dec, радиусу, интервалу MJD и диапазону длин волн.
- Настраиваемые коллекции DR1 и QR3, кэш метаданных с TTL.
- Вырезки через IRSA Cutout Service; преобразование на общую сетку ICRS/TAN.
- `cutout`, `stack` (среднее с обратными дисперсиями), `difference` (science − reference),
  `blink` (PNG-кадры и GIF по времени).
- Маски FLAGS, опциональное вычитание ZODI, перенос дисперсий при интерполяции.
- FITS, PNG, GIF и JSON с параметрами обработки, источниками и ограничениями.
- Сохраняемая очередь SQLite, отдельный worker, heartbeat и восстановление после потери worker.
- OpenAPI, TypeScript-клиент, Docker Compose и проверки GitHub Actions.

## Подключение интерфейса

**NEOSSat подключён как дополнительный реальный источник**: поиск через
`/api/v1/observations?source=neossat&ra=...&dec=...`, вырезки и blink через общую
очередь задач. [Примеры, единицы и ограничения](docs/neossat.md).
Проверка: `uv run python scripts/verify_neossat.py`.

1. `GET /api/v1/capabilities` — режим данных, операции, детекторы и лимиты.
2. `GET /api/v1/observations?ra=269.4521&dec=4.6934&radius_deg=0.05` — наблюдения.
3. `POST /api/v1/jobs` — выбранная операция и ID наблюдений из поиска.
4. `GET /api/v1/jobs/{id}` каждые 2 секунды, пока статус не станет `succeeded` или `failed`.
5. Отобразить изображения по `artifacts[].url`; сохранить FITS для дальнейшего анализа.

Пример тела задачи:

```json
{
  "kind": "difference",
  "observation_ids": ["<reference ID из поиска>", "<science ID из поиска>"],
  "ra": 269.4521,
  "dec": 4.6934,
  "fov_deg": 0.1,
  "size_px": 256,
  "subtract_zodi": true
}
```

Для разности и сложения выбирайте один детектор. При изменении координат выполняйте новый поиск.
`radius_deg` — радиус поиска; `fov_deg` — сторона выходного изображения, это разные параметры.
При `possibly_truncated=true` результат не является полным списком эпох: сузьте время/длины волн.

Для Gemini/фронтенда: [инструкция интеграции](docs/frontend-integration.md),
[OpenAPI](docs/openapi.json), [TypeScript-клиент](packages/api-client/src/index.ts).

## Проверки

```powershell
uv run ruff check .
uv run ruff format --check .
uv run pytest -q
uv run python scripts/smoke.py
uv run python scripts/export_openapi.py
```

Тесты и smoke работают без сети. Отдельная проверка реального IRSA (нужен интернет):

```powershell
uv run python scripts/verify_irsa.py
```

Проверка пяти обязательных полей из условия и создание реальных blink-анимаций:

```text
uv run python scripts/verify_targets.py
```

Результаты сохраняются локально в `data/target-validation`; пригодность кадров
не означает подтверждённое обнаружение или движение целевого объекта.
Готовые координаты полей доступны через `GET /api/v1/targets`.
Статус каждого источника из Resources указан в [таблице источников](docs/data-sources.md).

## Docker

```text
docker compose up --build
```

API доступен на `127.0.0.1:8000`; worker разделяет с ним том данных. Для реального архива
задайте `SPHEREX_PROVIDER=irsa` в `.env`. Docker не обязателен для локальной разработки.

## Структура

```text
backend/src/spherex/
  api.py          # HTTP, валидация, контракт
  models.py       # публичные схемы запросов и ответов
  config.py       # настройки окружения
  providers/      # адаптер IRSA и синтетический demo
  science.py      # WCS, маски, дисперсии, FITS, изображения
  processing.py   # последовательность обработки и provenance
  storage.py      # SQLite, кэш, очередь, версия схемы
  worker.py       # отдельный процесс обработки
backend/tests/    # API, научные операции, адаптер, очередь
packages/api-client/ # клиент для будущего фронтенда
docs/             # архитектура, контракт, план развития
scripts/          # smoke, live-проверка, экспорт OpenAPI
```

## Важные ограничения

SPHEREx использует 102 спектральных канала и шесть детекторов. Нельзя считать, что
один файл содержит готовый спектр из 102 значений. Длина волны зависит от положения на детекторе.
Текущее сложение внутри одного детектора — обзорная визуализация, без согласования длин волн.
Разность не включает согласование PSF, дополнительную астрометрическую коррекцию или подбор фона.
Маски и дисперсии помогают интерпретации, но результат требует научной проверки.

Спектры по калибровкам CWAVE/CBAND, каталоги Gaia/WISE и поиск кандидатов на движение —
следующие этапы, перечисленные в [плане развития](docs/roadmap.md).

Это локальный/командный прототип без авторизации и ограничения частоты запросов.
Перед публичным размещением нужны квоты, контроль диска, TLS и ограничения на входе;
см. [архитектуру и эксплуатацию](docs/architecture.md).

## Совместная разработка

Инструкции по веткам, проверкам и контракту: [CONTRIBUTING.md](CONTRIBUTING.md).
Файлы данных, `.env`, окружение и кэши исключены из Git. Удалённый репозиторий подключается
отдельно; подготовка исходников не публикует проект автоматически.

Источники и проверенные интерфейсы данных: [docs/data-sources.md](docs/data-sources.md).

## Рабочая ветка и проверка Demotest1

В этой папке работаем только в ветке `Demotest1`; изменения в `main` не отправляются.
В PowerShell нестандартные порты задаются переменными `$env:PORT` и `$env:FRONTEND_PORT`.
Все способы запуска используют `scripts/run_dashboard.py`: API, worker и Vite проверяются
на готовность; ошибка запуска или Ctrl+C останавливает дочерние сервисы. Занятые порты
не заменяются автоматически. Повторный быстрый запуск: `SKIP_SYNC=1 bash start.sh`.

Для отдельного запуска Vite API по умолчанию проксируется на `127.0.0.1:8000`.
Другой адрес API задаётся `VITE_API_PROXY_TARGET` при запуске Vite.
`VITE_API_BASE_URL` используется при размещении фронтенда и API на разных адресах;
для production нужно отдельно настроить reverse proxy или этот адрес и CORS.

Ошибки API не заменяются демонстрационными наблюдениями или фиктивными результатами.
Синтетический SPHEREx demo включается только настройкой бэкенда; NEOSSat всегда
запрашивается из CADC. Временные 429/502/503/504 и сетевые ошибки IRSA повторяются
один раз. Недоступность архива после повтора остаётся видимой ошибкой.
Спектральная панель — иллюстративный прототип без измеренного спектра/проверки кандидатов.
