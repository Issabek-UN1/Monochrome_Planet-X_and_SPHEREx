export type Language = 'en' | 'ru'

export interface TranslationDictionary {
  [key: string]: string
}

export const translations: Record<Language, TranslationDictionary> = {
  en: {
    // Brand & Navigation
    'brand.title': 'MONOCHROME',
    'modes.vault': 'Orbital vault',
    'modes.comparator': 'Target comparator',
    'modes.spectral': 'Spectral lab',
    'modes.explorer': 'Live explorer',

    // Header actions & SR
    'header.langAria': 'Switch to Russian',
    'header.soundMute': 'Mute sound effects',
    'header.soundEnable': 'Enable sound effects',
    'header.gridToggle': 'Toggle HUD grid',
    'header.gridOn': 'Grid On',
    'header.gridOff': 'Grid Off',
    'header.apiUnavailable': 'API UNAVAILABLE',
    'header.irsaRealData': 'IRSA REAL DATA',
    'header.syntheticDemo': 'SYNTHETIC DEMO',

    // Skip link
    'app.skipLink': 'Skip to mission workspace',

    // Hero Section (Vault)
    'hero.eyebrow': 'TIME-DOMAIN SKY EXPLORER',
    'hero.titleLine1': 'The sky',
    'hero.titleLine2': "doesn't",
    'hero.titleLine3': 'stand still.',
    'hero.descLine1': 'A universe in motion.',
    'hero.descLine2': 'Find the signal between the moments.',
    'hero.cta': 'EXPLORE ARCHIVE ->',

    // Vault Directory Section
    'directory.comparator.title': 'TARGET COMPARATOR',
    'directory.comparator.desc':
      'Multi-epoch blink comparison & Planet X hypothesis sliders',
    'directory.spectral.title': 'SPECTRAL LAB',
    'directory.spectral.desc':
      'SPHEREx infrared spectral energy distribution analysis',
    'directory.explorer.title': 'LIVE EXPLORER',
    'directory.explorer.desc':
      'Real-time IRSA sky coordinate & proper motion lookup',

    // Target Carousel
    'carousel.ariaLabel': 'Challenge targets',
    'carousel.field': 'FIELD',

    // Target Categories
    'category.Planet X Analogue': 'Planet X Analogue',
    'category.High Proper Motion': 'High Proper Motion',
    'category.Sub-stellar Brown Dwarf': 'Sub-stellar Brown Dwarf',
    'category.Variable Star': 'Variable Star',
    'category.Pulsating Giant': 'Pulsating Giant',
    'category.Custom Field': 'Custom Field',

    // Target Summaries & Notes
    'target.wise-0855.desc':
      'The coldest known sub-stellar brown dwarf (~250 K / -23 °C). An ideal infrared proxy for detecting a cold, distant Planet X.',
    'target.wise-0855.notes':
      'Coordinates supplied in the challenge. Sub-stellar candidate.',
    'target.barnards-star.desc':
      'Fastest moving star in Earth’s sky. Moves 10.3 arcsec per year, providing the ultimate benchmark for multi-epoch change detection.',
    'target.barnards-star.notes':
      'Reference field centre for fastest moving star across Earth night sky.',
    'target.epsilon-indi-b.desc':
      'One of the closest methane-rich T-type brown dwarf binaries, testing atmospheric methane absorption bands in SPHEREx spectra.',
    'target.epsilon-indi-b.notes':
      'Binary brown dwarf system near the solar neighborhood.',
    'target.rw-aurigae.desc':
      'Young variable star binary undergoing dramatic tidal occultations, testing protoplanetary dust and gas absorption signatures.',
    'target.rw-aurigae.notes':
      'Classic T Tauri variable system displaying severe visual fading.',
    'target.r-draconis.desc':
      'Long-period pulsating giant star demonstrating strong circumstellar envelope emission variations across SPHEREx infrared filters.',
    'target.r-draconis.notes':
      'Long-period pulsating red giant with circum-stellar dust emission.',
    'target.custom.desc': 'Coordinates supplied in the URL.',
    'target.custom.notes':
      'User-supplied field centre; no catalog classification.',

    // Comparator / Aperture
    'aperture.heading': 'The aperture.',
    'comparator.diagTitle': 'Target diagnostics',
    'comparator.selectedRef': 'SELECTED REFERENCE FIELD',
    'comparator.ra': 'RIGHT ASCENSION',
    'comparator.dec': 'DECLINATION',
    'comparator.fieldCentre': 'FIELD CENTRE',
    'comparator.wavelength': 'WAVELENGTH COVERAGE',
    'comparator.wavelengthVal': '0.75–5.00 µm / 6 detectors',
    'comparator.coordSource': 'Coordinate source ↗',
    'comparator.footnote':
      'Reference coordinates are not propagated to each epoch. Proper-motion vectors and source distances are not measured by this interface.',
    'comparator.loadTarget': 'LOAD TARGET OBSERVATIONS',
    'comparator.pipelineBusy': 'ARCHIVE PIPELINE BUSY',
    'comparator.baselineTitle': 'Temporal baseline',
    'comparator.detector': 'DETECTOR',
    'comparator.autoDetector': 'Auto / first available',
    'comparator.refEpoch': 'REFERENCE / EARLIER',
    'comparator.sciEpoch': 'SCIENCE / LATER',
    'comparator.latestAvailable': 'Latest available',
    'comparator.sampledSep': 'SAMPLED TIME SEPARATION',
    'comparator.days': 'DAYS',
    'comparator.buildComp': 'BUILD COMPARISON',
    'comparator.computeDiff': 'COMPUTE DIFFERENCE MAP',
    'comparator.orbitModel': 'Hypothetical Planet X Orbit Model',
    'comparator.semiMajor': 'SEMI-MAJOR AXIS a',
    'comparator.inclination': 'INCLINATION',
    'comparator.animateOrbit': 'ANIMATE ILLUSTRATIVE FLOW',
    'comparator.orbitFootnote':
      'Illustrative eccentric orbit · e = 0.65. Not a fitted orbit or a predicted sky position. Flow is illustrative.',
    'comparator.emptyBaseline': 'ESTABLISH A TEMPORAL BASELINE',
    'comparator.emptyDesc': 'Load observations and build a comparison.',
    'comparator.emptySub': 'Only processed archive products appear here.',
    'comparator.imageScale': 'NORTH ↑ / EAST ← /',
    'comparator.view': 'VIEW',
    'comparator.ref': 'REFERENCE',
    'comparator.sci': 'SCIENCE',
    'comparator.startBlink': 'START BLINK',
    'comparator.pauseBlink': 'PAUSE',
    'comparator.interval': 'INTERVAL',
    'comparator.splitPos': 'Epoch split position',
    'comparator.tabSplit': 'Split wipe',
    'comparator.tabBlink': 'Blink',
    'comparator.tabDiff': 'Difference',
    'comparator.tabFits': 'FITS / WCS',
    'comparator.scienceNotice':
      'A difference is exploratory, without PSF or wavelength matching. Residuals and brightness changes are not a confirmed moving-object detection.',
    'comparator.truncatedFootnote':
      'Limited archive sample; these are not guaranteed to be the earliest/latest mission visits.',
    'comparator.zoomNotice': 'FIELD · ZOOM IS VISUAL, NOT ASTROMETRY',
    'comparator.wcsGrid': 'SYNCHRONIZED WCS GRID',
    'comparator.pipelinePrefix': 'PIPELINE',
    'comparator.resumeJob': 'RESUME JOB STATUS CHECK',

    // Epoch Comparator Viewport & Telemetry
    'comparator.modeSplit': 'SPLIT',
    'comparator.modeBlink': 'BLINK',
    'comparator.modeVector': 'VECTOR',
    'comparator.metaBaseline': 'BASELINE',
    'comparator.metaProperMotion': 'PROPER MOTION',
    'comparator.metaAngularShift': 'ANGULAR SHIFT',
    'comparator.epochA': 'EPOCH A',
    'comparator.epochB': 'EPOCH B',
    'comparator.epochAArchive': 'EPOCH A / ARCHIVE',
    'comparator.epochBSpherex': 'EPOCH B / SPHEREx',

    // Spectral Lab
    'spectral.title': 'Spectral lab',
    'spectral.eyebrow': '03 / SPECTRAL ENERGY DISTRIBUTION',
    'spectral.heading': 'Spectroscopy.',
    'spectral.subtitle':
      'Deconstruct light across 102 SPHEREx spectral channels.',
    'spectral.sourceTag': 'CALIBRATED FLUX · 0.75 - 5.00 µm',
    'spectral.panelMolecules': 'Reference molecular signatures',
    'spectral.panelControls': 'Detector channel selection',
    'spectral.illustrative': 'ILLUSTRATIVE MODELS',
    'spectral.noClassification': 'NO CLASSIFICATION INFERRED',
    'spectral.estimatedFlux': 'ESTIMATED FLUX DENSITY',
    'spectral.scienceNotice':
      'No measured 102-channel spectrum is returned by the current API. Curves are normalized Planck/reference models, not observations or atmospheric classifications. Marker windows are approximate.',
    'spectral.footnoteRuler':
      'The 102-bin ruler is a visualization axis, not the calibrated instrument channel table. Detector bounds below are physical coverage; the small gaps are retained.',
    'spectral.footnoteMolecules':
      'Overlays mark reference absorption regions. They do not indicate a molecule detected in this field.',
    'spectral.classificationSub':
      'Calibrated source extraction is a future capability.',
    'spectral.modelReadoutBeyond': 'Beyond this plotted wavelength range',
    'spectral.modelReadoutWithin': 'Within the plotted range',
    'spectral.compareSolar': 'Compare reflected-solar shape',
    'spectral.exportCsv': 'EXPORT MODEL CSV',
    'spectral.panelSed': 'Spectral energy distribution',
    'spectral.modelRel': 'MODEL / RELATIVE Fλ',
    'spectral.selectedWavelength': 'SELECTED WAVELENGTH',
    'spectral.referenceField': 'REFERENCE FIELD',
    'spectral.customField': 'Custom field',
    'spectral.panelMoleculesTitle': 'Molecular references',
    'spectral.panelContinuumTitle': 'Continuum model',
    'spectral.modelTemp': 'MODEL TEMPERATURE',
    'spectral.wienPeak': 'WIEN PEAK / Fλ',

    // Sky Explorer
    'explorer.title': 'Live explorer',
    'explorer.eyebrow': '04 / ALL-SKY CATALOG',
    'explorer.heading': 'Sky explorer.',
    'explorer.subtitle':
      'Query archival observations and submit server-side difference workflows.',
    'explorer.signalAcquisition': 'Signal acquisition',
    'explorer.queryObservations': 'QUERY ARCHIVE OBSERVATIONS',
    'explorer.generateBlink': 'GENERATE BLINK ANIMATION',
    'explorer.difference': 'DIFFERENCE IMAGE',
    'explorer.scienceNoticeSynthetic':
      'SYNTHETIC DEMO DATA · Generated by the backend. Not telescope observations.',
    'explorer.scienceNoticeTruncated':
      'LIMITED SAMPLE · More observations may exist. Narrow the radius or time range before interpreting epoch coverage.',
    'explorer.panelFootnoteNeossat':
      'NEOSSat: cutout / blink only. No fabricated variance or infrared calibration.',
    'explorer.panelFootnoteRadius':
      'Field search radius is fixed at 0.1° (~6 arcmin). To query larger areas, subdivide the target field into overlapping grid coordinates.',
    'explorer.qualityNotesSummary': 'DATA QUALITY & PROCESSING NOTES',
    'explorer.readyForDispatch': 'READY FOR DISPATCH',
    'explorer.pipelineStandby': 'PIPELINE / STANDBY',
    'explorer.resumePolling': 'Resume polling',
    'explorer.eventLog': 'PIPELINE EVENT LOG',
    'explorer.connectionReady': 'Connection ready. Awaiting your first request.',
    'explorer.pointingSolution': 'Pointing solution',
    'explorer.archiveObservations': 'Archive observations',
    'explorer.observationPipeline': 'Observation pipeline',
    'explorer.scientificViewport': 'Scientific viewport',

    // Footer
    'footer.pipelineActive': 'PIPELINE ACTIVE',
    'footer.workspaceReady': 'WORKSPACE READY',
    'footer.archivalData': 'ARCHIVAL DATA · NOT LIVE SPACECRAFT TELEMETRY',
    'footer.coords': 'MONOCHROME / SPACE APPS 2026 + ICRS EQUATORIAL',
  },
  ru: {
    // Brand & Navigation
    'brand.title': 'MONOCHROME',
    'modes.vault': 'Орбитальный свод',
    'modes.comparator': 'Компаратор целей',
    'modes.spectral': 'Спектральная лаборатория',
    'modes.explorer': 'Исследователь неба',

    // Header actions & SR
    'header.langAria': 'Switch to English',
    'header.soundMute': 'Выключить звук',
    'header.soundEnable': 'Включить звук',
    'header.gridToggle': 'Переключить сетку HUD',
    'header.gridOn': 'Сетка вкл',
    'header.gridOff': 'Сетка выкл',
    'header.apiUnavailable': 'API НЕДОСТУПЕН',
    'header.irsaRealData': 'РЕАЛЬНЫЕ ДАННЫЕ IRSA',
    'header.syntheticDemo': 'ДЕМО ДАННЫЕ',

    // Skip link
    'app.skipLink': 'Перейти к рабочей области',

    // Hero Section (Vault)
    'hero.eyebrow': 'ИССЛЕДОВАТЕЛЬ НЕБА ВО ВРЕМЕННОЙ ОБЛАСТИ',
    'hero.titleLine1': 'Небо',
    'hero.titleLine2': 'не стоит',
    'hero.titleLine3': 'на месте.',
    'hero.descLine1': 'Вселенная в непрерывном движении.',
    'hero.descLine2': 'Найдите сигнал между мгновениями.',
    'hero.cta': 'ИССЛЕДОВАТЬ АРХИВ ->',

    // Vault Directory Section
    'directory.comparator.title': 'КОМПАРАТОР ЦЕЛЕЙ',
    'directory.comparator.desc':
      'Многоэпоховое сравнение (мигание/разность) и гипотеза Девятой планеты',
    'directory.spectral.title': 'СПЕКТРАЛЬНАЯ ЛАБОРАТОРИЯ',
    'directory.spectral.desc':
      'Анализ спектрального распределения энергии в ИК-диапазоне SPHEREx',
    'directory.explorer.title': 'ИССЛЕДОВАТЕЛЬ НЕБА',
    'directory.explorer.desc':
      'Поиск небесных координат и собственного движения в IRSA в реальном времени',

    // Target Carousel
    'carousel.ariaLabel': 'Целевые объекты',
    'carousel.field': 'ПОЛЕ',

    // Target Categories
    'category.Planet X Analogue': 'Аналог Девятой планеты',
    'category.High Proper Motion': 'Высокое собственное движение',
    'category.Sub-stellar Brown Dwarf': 'Субзвёздный коричневый карлик',
    'category.Variable Star': 'Переменная звезда',
    'category.Pulsating Giant': 'Пульсирующий гигант',
    'category.Custom Field': 'Пользовательское поле',

    // Target Summaries & Notes
    'target.wise-0855.desc':
      'Самый холодный из известных субзвёздных коричневых карликов (~250 K / -23 °C). Идеальный инфракрасный аналог для обнаружения холодной далёкой Девятой планеты.',
    'target.wise-0855.notes':
      'Координаты предоставлены в задании миссии. Субзвёздный кандидат.',
    'target.barnards-star.desc':
      'Самая быстродвижущаяся звезда на земном небе. Смещение 10.3 угловых секунд в год — эталонный объект для проверки многоэпохового обнаружения изменений.',
    'target.barnards-star.notes':
      'Опорный центр поля для звезды с наибольшим собственным движением на ночном небе.',
    'target.epsilon-indi-b.desc':
      'Одна из ближайших богатых метаном двойных систем коричневых карликов спектрального класса T; тестовый объект для полос поглощения метана в спектрах SPHEREx.',
    'target.epsilon-indi-b.notes':
      'Двойная система коричневых карликов в непосредственной близости от Солнечной системы.',
    'target.rw-aurigae.desc':
      'Молодая двойная переменная звезда, испытывающая сильные приливные затмения; проверка признаков поглощения протопланетной пыли и газа.',
    'target.rw-aurigae.notes':
      'Классическая переменная система типа T Тельца с глубокими оптическими потускнениями.',
    'target.r-draconis.desc':
      'Долгопериодический пульсирующий гигант с мощными вариациями излучения околозвездной пылевой оболочки в инфракрасных фильтрах SPHEREx.',
    'target.r-draconis.notes':
      'Долгопериодический пульсирующий красный гигант с излучением околозвездной пыли.',
    'target.custom.desc': 'Координаты заданы через параметры URL.',
    'target.custom.notes':
      'Пользовательский центр поля; классификация в каталоге отсутствует.',

    // Comparator / Aperture
    'aperture.heading': 'Апертура.',
    'comparator.diagTitle': 'Диагностика цели',
    'comparator.selectedRef': 'ВЫБРАННОЕ ОПОРНОЕ ПОЛЕ',
    'comparator.ra': 'ПРЯМОЕ ВОСХОЖДЕНИЕ',
    'comparator.dec': 'СКЛОНЕНИЕ',
    'comparator.fieldCentre': 'ЦЕНТР ПОЛЯ',
    'comparator.wavelength': 'ДИАПАЗОН ДЛИН ВОЛН',
    'comparator.wavelengthVal': '0.75–5.00 мкм / 6 детекторов',
    'comparator.coordSource': 'Источник координат ↗',
    'comparator.footnote':
      'Опорные координаты не экстраполируются на каждую эпоху. Векторы собственного движения и расстояния не вычисляются данным интерфейсом.',
    'comparator.loadTarget': 'ЗАГРУЗИТЬ НАБЛЮДЕНИЯ ЦЕЛИ',
    'comparator.pipelineBusy': 'КОНВЕЙЕР АРХИВА ЗАНЯТ',
    'comparator.baselineTitle': 'Временная база',
    'comparator.detector': 'ДЕТЕКТОР',
    'comparator.autoDetector': 'Авто / первый доступный',
    'comparator.refEpoch': 'ОПОРНАЯ / РАННЯЯ',
    'comparator.sciEpoch': 'НАУЧНАЯ / ПОЗДНЯЯ',
    'comparator.latestAvailable': 'Последняя доступная',
    'comparator.sampledSep': 'ВЫБРАННЫЙ ИНТЕРВАЛ ВРЕМЕНИ',
    'comparator.days': 'ДНЕЙ',
    'comparator.buildComp': 'СОЗДАТЬ СРАВНЕНИЕ',
    'comparator.computeDiff': 'ПОСТРОИТЬ РАЗНОСТНУЮ КАРТУ',
    'comparator.orbitModel': 'Модель гипотетической орбиты Девятой планеты',
    'comparator.semiMajor': 'БОЛЬШАЯ ПОЛУОСЬ a',
    'comparator.inclination': 'НАКЛОНЕНИЕ',
    'comparator.animateOrbit': 'АНИМИРОВАТЬ НАГЛЯДНЫЙ ПОТОК',
    'comparator.orbitFootnote':
      'Иллюстративная эксцентрическая орбита · e = 0.65. Не является аппроксимированной орбитой или предсказанием позиции. Движение наглядно.',
    'comparator.emptyBaseline': 'ОПРЕДЕЛИТЬ ВРЕМЕННУЮ БАЗУ',
    'comparator.emptyDesc': 'Загрузите наблюдения и сформируйте сравнение.',
    'comparator.emptySub': 'Здесь отображаются только обработанные архивные продукты.',
    'comparator.imageScale': 'СЕВЕР ↑ / ВОСТОК ← /',
    'comparator.view': 'МАСШТАБ',
    'comparator.ref': 'ОПОРНЫЙ',
    'comparator.sci': 'НАУЧНЫЙ',
    'comparator.startBlink': 'ЗАПУСК МИГАНИЯ',
    'comparator.pauseBlink': 'ПАУЗА',
    'comparator.interval': 'ИНТЕРВАЛ',
    'comparator.splitPos': 'Положение разделителя эпох',
    'comparator.tabSplit': 'Шторка',
    'comparator.tabBlink': 'Мигание',
    'comparator.tabDiff': 'Разность',
    'comparator.tabFits': 'FITS / WCS',
    'comparator.scienceNotice':
      'Разностное изображение носит исследовательский характер, без согласования функции рассеяния точки (PSF) или длин волн. Невязки и вариации яркости не являются подтвержденным обнаружением движущегося объекта.',
    'comparator.truncatedFootnote':
      'Ограниченная выборка архива; данные наблюдения не гарантируют отражение самых ранних или поздних проходов миссии.',
    'comparator.zoomNotice': 'ПОЛЕ · ЗУМ ВИЗУАЛЬНЫЙ, НЕ АСТРОМЕТРИЧЕСКИЙ',
    'comparator.wcsGrid': 'СИНХРОНИЗИРОВАННАЯ СЕТКА WCS',
    'comparator.pipelinePrefix': 'КОНВЕЙЕР',
    'comparator.resumeJob': 'ВОЗОБНОВИТЬ ОПРОС СТАТУСА ЗАДАЧИ',

    // Epoch Comparator Viewport & Telemetry
    'comparator.modeSplit': 'ШТОРКА',
    'comparator.modeBlink': 'МИГАНИЕ',
    'comparator.modeVector': 'ВЕКТОР',
    'comparator.metaBaseline': 'ВРЕМЕННАЯ БАЗА',
    'comparator.metaProperMotion': 'СОБСТВЕННОЕ ДВИЖЕНИЕ',
    'comparator.metaAngularShift': 'УГЛОВОЕ СМЕЩЕНИЕ',
    'comparator.epochA': 'ЭПОХА A',
    'comparator.epochB': 'ЭПОХА B',
    'comparator.epochAArchive': 'ЭПОХА A / АРХИВ',
    'comparator.epochBSpherex': 'ЭПОХА B / SPHEREx',

    // Spectral Lab
    'spectral.title': 'Спектральная лаборатория',
    'spectral.eyebrow': '03 / СПЕКТРАЛЬНОЕ РАСПРЕДЕЛЕНИЕ ЭНЕРГИИ',
    'spectral.heading': 'Спектроскопия.',
    'spectral.subtitle':
      'Декомпозиция светового излучения по 102 спектральным каналам SPHEREx.',
    'spectral.sourceTag': 'КАЛИБРОВАННЫЙ ПОТОК · 0.75 - 5.00 мкм',
    'spectral.panelMolecules': 'Эталонные молекулярные спектры',
    'spectral.panelControls': 'Выбор детекторного канала',
    'spectral.illustrative': 'НАГЛЯДНЫЕ МОДЕЛИ',
    'spectral.noClassification': 'КЛАССИФИКАЦИЯ НЕ ОПРЕДЕЛЕНА',
    'spectral.estimatedFlux': 'РАСЧЕТНАЯ ПЛОТНОСТЬ ПОТОКА',
    'spectral.scienceNotice':
      'Текущий API не возвращает измеренный 102-канальный спектр. Кривые представляют собой нормированные модели Планка/эталоны, а не прямые наблюдения или классификацию атмосферы. Окна маркеров приблизительны.',
    'spectral.footnoteRuler':
      'Шкала на 102 интервала является осью визуализации, а не калиброванной таблицей каналов прибора. Границы детекторов ниже отражают физический охват с сохранением межсегментных зазоров.',
    'spectral.footnoteMolecules':
      'Наложения отмечают эталонные области поглощения и не свидетельствуют об обнаружении данной молекулы в выбранном поле.',
    'spectral.classificationSub':
      'Калиброванное извлечение источников — функционал будущих версий.',
    'spectral.modelReadoutBeyond': 'За пределами отображаемого диапазона длин волн',
    'spectral.modelReadoutWithin': 'В пределах отображаемого диапазона',
    'spectral.compareSolar': 'Сравнить с профилем отражённого солнечного света',
    'spectral.exportCsv': 'ЭКСПОРТИРОВАТЬ МОДЕЛЬ CSV',
    'spectral.panelSed': 'Спектральное распределение энергии',
    'spectral.modelRel': 'МОДЕЛЬ / ОТНОСИТЕЛЬНАЯ Fλ',
    'spectral.selectedWavelength': 'ВЫБРАННАЯ ДЛИНА ВОЛНЫ',
    'spectral.referenceField': 'ОПОРНОЕ ПОЛЕ',
    'spectral.customField': 'Пользовательское поле',
    'spectral.panelMoleculesTitle': 'Молекулярные эталоны',
    'spectral.panelContinuumTitle': 'Модель континуума',
    'spectral.modelTemp': 'ТЕМПЕРАТУРА МОДЕЛИ',
    'spectral.wienPeak': 'МАКСИМУМ ВИНА / Fλ',

    // Sky Explorer
    'explorer.title': 'Исследователь неба',
    'explorer.eyebrow': '04 / ОБЗОР ВСЕГО НЕБА',
    'explorer.heading': 'Исследователь неба.',
    'explorer.subtitle':
      'Запрос архивных наблюдений и запуск серверных разностных конвейеров.',
    'explorer.signalAcquisition': 'Приём сигнала',
    'explorer.queryObservations': 'ЗАПРОСИТЬ НАБЛЮДЕНИЯ АРХИВА',
    'explorer.generateBlink': 'СОЗДАТЬ АНИМАЦИЮ МИГАНИЯ',
    'explorer.difference': 'РАЗНОСТНОЕ ИЗОБРАЖЕНИЕ',
    'explorer.scienceNoticeSynthetic':
      'СИНТЕТИЧЕСКИЕ ДЕМО-ДАННЫЕ · Сгенерированы бэкендом. Не являются телескопическими наблюдениями.',
    'explorer.scienceNoticeTruncated':
      'ОГРАНИЧЕННАЯ ВЫБОРКА · Могут существовать дополнительные наблюдения. Уменьшите радиус поиска или временной интервал перед анализом покрытия эпох.',
    'explorer.panelFootnoteNeossat':
      'NEOSSat: только кадрирование / мигание. Без искусственной дисперсии или инфракрасной калибровки.',
    'explorer.panelFootnoteRadius':
      'Радиус поиска поля зафиксирован на 0.1° (~6 угловых минут). Для исследования больших областей разбейте целевое поле на перекрывающиеся координаты сетки.',
    'explorer.qualityNotesSummary': 'СВОДКА КАЧЕСТВА ДАННЫХ И ПРИМЕЧАНИЯ К ОБРАБОТКЕ',
    'explorer.readyForDispatch': 'ГОТОВ К ОТПРАВКЕ',
    'explorer.pipelineStandby': 'КОНВЕЙЕР / ОЖИДАНИЕ',
    'explorer.resumePolling': 'Возобновить опрос',
    'explorer.eventLog': 'ЖУРНАЛ СОБЫТИЙ КОНВЕЙЕРА',
    'explorer.connectionReady': 'Соединение готово. Ожидание первого запроса.',
    'explorer.pointingSolution': 'Параметры наведения',
    'explorer.archiveObservations': 'Архивные наблюдения',
    'explorer.observationPipeline': 'Конвейер обработки',
    'explorer.scientificViewport': 'Научная визуализация',

    // Footer
    'footer.pipelineActive': 'КОНВЕЙЕР АКТИВЕН',
    'footer.workspaceReady': 'РАБОЧАЯ ОБЛАСТЬ ГОТОВА',
    'footer.archivalData': 'АРХИВНЫЕ ДАННЫЕ · НЕ ТЕЛЕМЕТРИЯ РЕАЛЬНОГО ВРЕМЕНИ',
    'footer.coords': 'MONOCHROME / SPACE APPS 2026 + ЭКВАТОРИАЛЬНЫЙ ICRS',
  },
}
