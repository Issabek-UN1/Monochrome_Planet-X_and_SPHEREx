# Источники данных и проверка

Проверено 14 ноября 2026 года.

## Условие хакатона

[Planet X and SPHEREx](https://www.spaceappschallenge.org/2026/challenges/planet-x-and-spherex/?tab=details).
Официальная страница при автоматическом чтении возвращала 403/502. В основу текущего
плана положены предоставленные участником пункты Potential Considerations и официальная
документация архива. Перед финальной подачей команда должна сверить полное условие,
ресурсы и критерии непосредственно на сайте хакатона.

## Официальные документы архива

- [SPHEREx Data Releases](https://caltech-ipac.github.io/spherex-archive-documentation/spherex-data-releases/):
  DR1 охватывает первые два обзора; QR3 — следующие. Текущая конфигурация ищет обе коллекции.
- [SPHEREx Data Access](https://caltech-ipac.github.io/spherex-archive-documentation/spherex-data-access/):
  SIA2 discovery, `access_url`, сервис вырезок через `center` и `size`.
  Коллекции и релизы задаются конфигурацией, не пользовательским URL.
- [IRSA SIA2](https://irsa.ipac.caltech.edu/ibe/sia.html): координаты POS в ICRS-градусах,
  TIME в MJD, BAND в метрах, MAXREC и CSV-ответы.
- [SPHEREx Data Products](https://caltech-ipac.github.io/spherex-archive-documentation/spherex-data-products/):
  IMAGE, FLAGS, VARIANCE, ZODI; шесть диапазонов детекторов.
  WCS-WAVE предназначен для визуализации, CWAVE/CBAND — для научных измерений.
- [IRSA spectrophotometry](https://irsa.ipac.caltech.edu/onlinehelp/spherex/spherex/sp.html):
  source-mask bit 21 сам по себе не означает плохое состояние измерения; остальные
  флаги в MVP по умолчанию отклоняются консервативно.

## Результат live-проверки при подготовке

Поиск SIA2 около RA=127.69444°, Dec=−39.17760° вернул пять записей (запрошенный лимит).
Загружена реальная вырезка DR1 размером 3 954 240 байт с HDU IMAGE, FLAGS, VARIANCE,
ZODI, EPSF и WCS-WAVE; преобразование в 64×64 дало 1053 пригодных пикселя с маской по умолчанию.
Один из предварительных запросов вернул HTTP 503; последующая проверка прошла.
Эта проверка подтверждает совместимость адаптера с одним реальным продуктом,
но не гарантирует доступность всего архива или всех релизов.

В репозитории нет скопированных научных данных. `scripts/verify_irsa.py` позволяет
повторить live-проверку самостоятельно; её результат зависит от архива.
