# Проверка подготовки к размещению — 15 ноября 2026

Подготовка выполнена в локальной копии `Monochrome_Planet-X_and_SPHEREx-Site_Deploy`.
Исходники подготовлены для ветки `Site_Deploy`; облачный deploy и платные ресурсы
не создавались. Основной `render.yaml` использует Free без постоянного диска,
платный вариант сохранён отдельно в `render.persistent.yaml`.

| Проверка | Результат |
| --- | --- |
| `uv sync --frozen` | Успешно, Python 3.13.3; `uv.lock` не менялся |
| `ruff check .` | Успешно |
| `ruff format --check .` | Успешно, 56 Python-файлов |
| `pytest -q --basetemp=.pytest_cache/deployment-tests` | 91 passed |
| `python scripts/smoke.py` | cutout, stack, difference, blink: OK |
| `npm ci --include=dev` в frontend | Успешно по package-lock.json |
| `npm test` в frontend | 25 passed, 9 файлов |
| `npm run build` в frontend | Успешно, TypeScript + Vite production bundle |
| `npm run lint` в frontend | Успешно |
| `python scripts/smoke_deployment.py` | HTTP: HTML, собранные JS/CSS, API, отдельный worker, задача и артефакты: OK |
| Экспорт OpenAPI | Выполнен; схема совпадает, новый static mount не добавляет API operations |
| Генерация API-клиента + `npm run check` | Успешно, типы не изменились |
| Разбор Render/Compose/CI YAML | Успешно; облачная валидация Render не выполнялась |
| Локальная сборка Docker | Не выполнялась: Docker отсутствует |
| Проверка реального IRSA | Не выполнялась; отдельна от офлайн-проверок |

Первый запуск pytest встретил запрет доступа к общей временной папке Windows.
Повтор с временными файлами внутри игнорируемой `.pytest_cache` прошёл полностью.
Предупреждения Starlette о TestClient и jsdom о Canvas/scrollTo не приводят к падению тестов.

В CI добавлены сборка production-образа, запуск с явным `SPHEREX_PROVIDER=demo`
и нестандартным `PORT=8787`, HTTP smoke и остановка контейнера с проверкой кода 0.
Эти проверки начнут выполняться после загрузки изменений в GitHub; успешный
локальный smoke не выдаётся за уже пройденную контейнерную проверку.

Деплой предназначен для пилота: аутентификация, квоты на посетителя, очистка файлов
и нагрузочные испытания остаются ограничениями. Инструкция и параметры хостинга:
[deployment.md](deployment.md).
