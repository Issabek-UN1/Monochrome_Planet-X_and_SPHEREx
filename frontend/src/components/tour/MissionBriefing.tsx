import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react'
import type { Mode } from '../layout/modes'
import { useI18n } from '../../i18n'
import { playTone } from '../../utils/audio'

const STORAGE_KEY_BRIEFING_COMPLETED = 'monochrome_briefing_completed'

export interface BriefingStep {
  step: number
  tabNumber: string
  mode: Mode
  selector: string
  titleKey: string
  titleEn: string
  titleRu: string
  descKey: string
  descEn: string
  descRu: string
  tagKey: string
  tagEn: string
  tagRu: string
}

const BRIEFING_STEPS: BriefingStep[] = [
  // ================= TAB 02 — TARGET COMPARATOR (4 Steps) =================
  {
    step: 1,
    tabNumber: 'TAB 02',
    mode: 'comparator',
    selector: '[data-tour-id="comp-targets"]',
    titleKey: 'briefing.step1.title',
    titleEn: 'TARGET FIELD SELECTOR',
    titleRu: 'ВЫБОР ОПОРНОЙ ЦЕЛИ',
    descKey: 'briefing.step1.desc',
    descEn:
      'Click any of the 5 curated benchmark targets (WISE 0855-0714 to R Draconis) to load paired observations from historical sky surveys (NEOSSat/WISE) and SPHEREx DR1, updating all astrometric telemetry.',
    descRu:
      'Выберите любой из 5 ключевых объектов каталога (от WISE 0855-0714 до R Дракона) для загрузки синхронизированных парных наблюдений из архивов (NEOSSat/WISE) и SPHEREx DR1.',
    tagKey: 'briefing.step1.tag',
    tagEn: '02 / TARGET COMPARATOR',
    tagRu: '02 / КОМПАРАТОР ЦЕЛЕЙ',
  },
  {
    step: 2,
    tabNumber: 'TAB 02',
    mode: 'comparator',
    selector: '[data-tour-id="comp-split"]',
    titleKey: 'briefing.step2.title',
    titleEn: 'INTERACTIVE SPLIT CURTAIN',
    titleRu: 'ИНТЕРАКТИВНАЯ ШТОРКА',
    descKey: 'briefing.step2.desc',
    descEn:
      'Drag the 1px vertical divider across the starfield to compare Epoch A (Archive: NEOSSat/WISE) and Epoch B (Current: SPHEREx) pixel-by-pixel on a locked coordinate grid to spot proper motion or flux changes.',
    descRu:
      'Перемещайте вертикальную шторку 1px по звездному полю, чтобы попиксельно сравнить эпоху A (архив NEOSSat/WISE) и эпоху B (SPHEREx) на зафиксированной сетке координат и выявить смещение или переменность блеска.',
    tagKey: 'briefing.step2.tag',
    tagEn: '02 / TARGET COMPARATOR',
    tagRu: '02 / КОМПАРАТОР ЦЕЛЕЙ',
  },
  {
    step: 3,
    tabNumber: 'TAB 02',
    mode: 'comparator',
    selector: '[data-tour-id="comp-blink"]',
    titleKey: 'briefing.step3.title',
    titleEn: 'BLINK MODE & SPACEBAR HOTKEY',
    titleRu: 'РЕЖИМ МИГАНИЯ И ПРОБЕЛ',
    descKey: 'briefing.step3.desc',
    descEn:
      'Toggle BLINK mode or press Spacebar to rapidly alternate frames every 500ms. Stationary background stars remain locked in place, while high-proper-motion targets and Planet X analogues jump out immediately.',
    descRu:
      'Включите режим BLINK или нажмите Пробел для быстрого чередования кадров с интервалом 500 мс. Фоновые звезды остаются неподвижными, а объекты с высоким собственным движением отчетливо совершают скачок.',
    tagKey: 'briefing.step3.tag',
    tagEn: '02 / TARGET COMPARATOR',
    tagRu: '02 / КОМПАРАТОР ЦЕЛЕЙ',
  },
  {
    step: 4,
    tabNumber: 'TAB 02',
    mode: 'comparator',
    selector: '[data-tour-id="comp-vector"]',
    titleKey: 'briefing.step4.title',
    titleEn: 'VECTOR OVERLAY & TELEMETRY BAR',
    titleRu: 'ВЕКТОР СМЕЩЕНИЯ И ТЕЛЕМЕТРИЯ',
    descKey: 'briefing.step4.desc',
    descEn:
      'Activate VECTOR to overlay a dashed astrometric displacement path between epochs. The telemetry bar below reports the temporal baseline, annual proper motion vector, and cumulative angular shift.',
    descRu:
      'Включите VECTOR для отображения пунктирного вектора астрометрического смещения между эпохами. Нижняя строка телеметрии отображает временную базу, вектор собственного движения и суммарный угловой сдвиг.',
    tagKey: 'briefing.step4.tag',
    tagEn: '02 / TARGET COMPARATOR',
    tagRu: '02 / КОМПАРАТОР ЦЕЛЕЙ',
  },

  // ================= TAB 03 — SPECTRAL LAB (4 Steps) =================
  {
    step: 5,
    tabNumber: 'TAB 03',
    mode: 'spectral',
    selector: '[data-tour-id="spec-selector"]',
    titleKey: 'briefing.step5.title',
    titleEn: 'TARGET & SPECTRUM SELECTOR',
    titleRu: 'ВЫБОР ЦЕЛИ И СПЕКТРА',
    descKey: 'briefing.step5.desc',
    descEn:
      'Choose an astronomical target or completed /spectrum job to extract calibrated infrared Spectral Energy Distribution (SED) data across all 102 SPHEREx spectral channels.',
    descRu:
      'Выберите целевой объект или завершенную задачу /spectrum для извлечения калиброванного спектрального распределения энергии (SED) по всем 102 каналам SPHEREx.',
    tagKey: 'briefing.step5.tag',
    tagEn: '03 / SPECTRAL LAB',
    tagRu: '03 / СПЕКТРАЛЬНАЯ ЛАБОРАТОРИЯ',
  },
  {
    step: 6,
    tabNumber: 'TAB 03',
    mode: 'spectral',
    selector: '[data-tour-id="spec-chart"]',
    titleKey: 'briefing.step6.title',
    titleEn: '6-BAND SPHEREX SPECTROGRAM',
    titleRu: '6-ЗОННАЯ СПЕКТРОГРАММА SPHEREx',
    descKey: 'briefing.step6.desc',
    descEn:
      "Inspect spectral surface brightness across SPHEREx's 6 detector wavelength bands covering 0.75 to 5.0 µm. Hover over data points to inspect exact channel wavelength, flux density, and measurement hits.",
    descRu:
      'Исследуйте спектральную яркость по 6 полосам детекторов SPHEREx в диапазоне от 0.75 до 5.0 мкм. Наведите курсор на точки для просмотра точной длины волны канала, плотности потока и отсчетов.',
    tagKey: 'briefing.step6.tag',
    tagEn: '03 / SPECTRAL LAB',
    tagRu: '03 / СПЕКТРАЛЬНАЯ ЛАБОРАТОРИЯ',
  },
  {
    step: 7,
    tabNumber: 'TAB 03',
    mode: 'spectral',
    selector: '[data-tour-id="spec-models"]',
    titleKey: 'briefing.step7.title',
    titleEn: 'MOLECULAR LINES & CONTINUUM MODELS',
    titleRu: 'МОЛЕКУЛЯРНЫЕ ЛИНИИ И МОДЕЛИ',
    descKey: 'briefing.step7.desc',
    descEn:
      'Overlay reference molecular absorption bands (CH₄, H₂O, CO₂, CO) and Planck blackbody continuum curves to distinguish cold substellar bodies (Planet X / brown dwarf analogues) from hotter background stars.',
    descRu:
      'Накладывайте эталонные молекулярные полосы поглощения (CH₄, H₂O, CO₂, CO) и планковские кривые абсолютно черного тела, чтобы отличить холодные субзвездные объекты от горячих фоновых звезд.',
    tagKey: 'briefing.step7.tag',
    tagEn: '03 / SPECTRAL LAB',
    tagRu: '03 / СПЕКТРАЛЬНАЯ ЛАБОРАТОРИЯ',
  },
  {
    step: 8,
    tabNumber: 'TAB 03',
    mode: 'spectral',
    selector: '[data-tour-id="spec-controls"]',
    titleKey: 'briefing.step8.title',
    titleEn: 'SCALE & COMPUTATION CONTROLS',
    titleRu: 'ДЕТЕКТОРЫ И ШКАЛЫ',
    descKey: 'briefing.step8.desc',
    descEn:
      'Switch between physical coverage detectors and scrub the 102-bin wavelength axis to isolate specific absorption features, analyze Wien peak shifts, or trigger fresh spectral extraction.',
    descRu:
      'Переключайтесь между физическими детекторами и перемещайте ползунок по 102 каналам для изоляции линий поглощения, анализа максимума Вина и запуска новой экстракции спектра.',
    tagKey: 'briefing.step8.tag',
    tagEn: '03 / SPECTRAL LAB',
    tagRu: '03 / СПЕКТРАЛЬНАЯ ЛАБОРАТОРИЯ',
  },

  // ================= TAB 04 — LIVE EXPLORER (3 Steps) =================
  {
    step: 9,
    tabNumber: 'TAB 04',
    mode: 'explorer',
    selector: '[data-tour-id="exp-coords"]',
    titleKey: 'briefing.step9.title',
    titleEn: 'ICRS COORDINATE POINTING',
    titleRu: 'НАВЕДЕНИЕ ПО КООРДИНАТАМ ICRS',
    descKey: 'briefing.step9.desc',
    descEn:
      'Enter equatorial sky coordinates in ICRS degrees (Right Ascension 0–360°, Declination ±90°) and specify an angular search radius up to 2° to explore arbitrary regions of the celestial sphere.',
    descRu:
      'Введите экваториальные координаты в градусах ICRS (прямое восхождение 0–360°, склонение ±90°) и укажите радиус поиска до 2° для исследования любой области небесной сферы.',
    tagKey: 'briefing.step9.tag',
    tagEn: '04 / LIVE EXPLORER',
    tagRu: '04 / ЖИВОЙ ИССЛЕДОВАТЕЛЬ',
  },
  {
    step: 10,
    tabNumber: 'TAB 04',
    mode: 'explorer',
    selector: '[data-tour-id="exp-search"]',
    titleKey: 'briefing.step10.title',
    titleEn: 'ARCHIVE SWITCHER & SKY QUERY',
    titleRu: 'ВЫБОР АРХИВА И ПОИСК НАБЛЮДЕНИЙ',
    descKey: 'briefing.step10.desc',
    descEn:
      'Switch between infrared SPHEREx (IRSA) and optical NEOSSat (CADC) data sources, then click SEARCH SKY to query available astronomical observation exposures with MJD timestamps and band coverage.',
    descRu:
      'Переключайтесь между инфракрасным архивом SPHEREx (IRSA) и оптическим NEOSSat (CADC), затем нажимайте поиск для получения списка кадров с датами MJD и диапазонами длин волн.',
    tagKey: 'briefing.step10.tag',
    tagEn: '04 / LIVE EXPLORER',
    tagRu: '04 / ЖИВОЙ ИССЛЕДОВАТЕЛЬ',
  },
  {
    step: 11,
    tabNumber: 'TAB 04',
    mode: 'explorer',
    selector: '[data-tour-id="exp-jobs"]',
    titleKey: 'briefing.step11.title',
    titleEn: 'PROCESSING PIPELINE & QUEUE JOB',
    titleRu: 'КОНВЕЙЕР ОБРАБОТКИ И ЗАДАЧИ',
    descKey: 'briefing.step11.desc',
    descEn:
      'Select up to 12 observation frames from the timeline, choose an image operation (CUTOUT, STACK, DIFFERENCE, or BLINK), and queue an asynchronous job to generate scientific FITS artifacts.',
    descRu:
      'Выберите до 12 кадров наблюдений из таблицы, выберите операцию (CUTOUT, STACK, DIFFERENCE или BLINK) и поставьте задачу в очередь обработки для создания научных FITS-артефактов.',
    tagKey: 'briefing.step11.tag',
    tagEn: '04 / LIVE EXPLORER',
    tagRu: '04 / ЖИВОЙ ИССЛЕДОВАТЕЛЬ',
  },
]

export interface MissionBriefingProps {
  isOpen: boolean
  initialStepIndex?: number
  onClose: () => void
  onSelectMode: (mode: Mode) => void
  currentMode: Mode
}

interface SpotlightRect {
  x: number
  y: number
  width: number
  height: number
}

interface CardPosition {
  top: number
  left: number
}

function findTargetElement(selector: string): HTMLElement | null {
  if (typeof document === 'undefined') return null

  // Ensure details in Tab 3 are opened if searching for spectral chart, models, or controls
  if (
    selector.includes('spec-chart') ||
    selector.includes('spec-models') ||
    selector.includes('spec-controls')
  ) {
    const qualityNotes = document.querySelector<HTMLDetailsElement>('details.quality-notes')
    if (qualityNotes && !qualityNotes.open) {
      qualityNotes.open = true
    }
  }

  const targetEl = document.querySelector<HTMLElement>(selector)
  if (!targetEl) return null

  const parentDetails = targetEl.closest('details')
  if (parentDetails && !parentDetails.open) {
    parentDetails.open = true
  }

  return targetEl
}

export const MissionBriefing: React.FC<MissionBriefingProps> = ({
  isOpen,
  initialStepIndex = 0,
  onClose,
  onSelectMode,
  currentMode,
}) => {
  const { lang, t } = useI18n()
  const [currentStepIndex, setCurrentStepIndex] = useState(initialStepIndex)
  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(null)
  const [cardPos, setCardPos] = useState<CardPosition>({ top: 120, left: 40 })
  const [isStepTransition, setIsStepTransition] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const currentStep = BRIEFING_STEPS[currentStepIndex] || BRIEFING_STEPS[0]
  const isLastStep = currentStepIndex === BRIEFING_STEPS.length - 1

  // Measure and position spotlight relative to target DOM element
  const updatePositions = useCallback(
    (stepToMeasure?: BriefingStep) => {
      if (typeof window === 'undefined') return

      const activeStep = stepToMeasure ?? currentStep
      const targetEl = findTargetElement(activeStep.selector)
      const padding = 12

      let rect: SpotlightRect | null = null
      if (targetEl) {
        const b = targetEl.getBoundingClientRect()
        if (b.width > 0 && b.height > 0) {
          const x = Math.max(0, b.left - padding)
          const y = Math.max(0, b.top - padding)
          rect = {
            x,
            y,
            width: Math.min(window.innerWidth - x, b.width + padding * 2),
            height: Math.min(window.innerHeight - y, b.height + padding * 2),
          }
        }
      }

      // If target element is not found yet, check visible container fallback
      if (!rect) {
        const container = document.querySelector<HTMLElement>(
          '.mode-content .hud-panel, .mode-content'
        )
        if (container) {
          const cb = container.getBoundingClientRect()
          if (cb.width > 0 && cb.height > 0) {
            const x = Math.max(0, cb.left - padding)
            const y = Math.max(0, cb.top - padding)
            rect = {
              x,
              y,
              width: Math.min(window.innerWidth - x, cb.width + padding * 2),
              height: Math.min(window.innerHeight - y, cb.height + padding * 2),
            }
          }
        }
      }

      if (rect) {
        setSpotlightRect(rect)

        // Compute optimal briefing card position (avoid overlapping target element and header)
        const cardWidth = Math.min(window.innerWidth - 32, 400)
        const cardHeight = 240
        const margin = 20
        const headerOffset = 64

        let optimalLeft = margin
        let optimalTop = headerOffset + margin

        // Strategy 1: If there is ample room to the left of the spotlight
        if (rect.x > cardWidth + margin * 2) {
          optimalLeft = Math.max(margin, rect.x - cardWidth - margin)
          optimalTop = Math.min(
            window.innerHeight - cardHeight - margin,
            Math.max(headerOffset + margin, rect.y),
          )
        }
        // Strategy 2: If there is ample room to the right of the spotlight
        else if (window.innerWidth - (rect.x + rect.width) > cardWidth + margin * 2) {
          optimalLeft = rect.x + rect.width + margin
          optimalTop = Math.min(
            window.innerHeight - cardHeight - margin,
            Math.max(headerOffset + margin, rect.y),
          )
        }
        // Strategy 3: Place below the spotlight if enough space
        else if (window.innerHeight - (rect.y + rect.height) > cardHeight + margin * 2) {
          optimalLeft = Math.min(
            window.innerWidth - cardWidth - margin,
            Math.max(margin, rect.x),
          )
          optimalTop = rect.y + rect.height + margin
        }
        // Strategy 4: Place above the spotlight
        else if (rect.y - headerOffset > cardHeight + margin * 2) {
          optimalLeft = Math.min(
            window.innerWidth - cardWidth - margin,
            Math.max(margin, rect.x),
          )
          optimalTop = Math.max(headerOffset + margin, rect.y - cardHeight - margin)
        }
        // Fallback: bottom-left anchored
        else {
          optimalLeft = margin
          optimalTop = Math.max(headerOffset + margin, window.innerHeight - cardHeight - margin)
        }

        // Clamp inside viewport
        optimalTop = Math.max(
          headerOffset + 8,
          Math.min(window.innerHeight - cardHeight - 16, optimalTop),
        )
        optimalLeft = Math.max(16, Math.min(window.innerWidth - cardWidth - 16, optimalLeft))

        setCardPos({ top: optimalTop, left: optimalLeft })
      }
    },
    [currentStep],
  )

  // Transition to step: switch mode, wait for DOM mount, position spotlight, and auto-scroll
  const goToStep = useCallback(
    (index: number) => {
      const nextIndex = Math.max(0, Math.min(BRIEFING_STEPS.length - 1, index))
      const nextStep = BRIEFING_STEPS[nextIndex]

      if (timerRef.current) clearTimeout(timerRef.current)
      if (pollingRef.current) clearTimeout(pollingRef.current)

      setIsStepTransition(true)
      setCurrentStepIndex(nextIndex)

      if (currentMode !== nextStep.mode) {
        onSelectMode(nextStep.mode)
      }

      // Automatically sync comparator sub-mode if entering Tab 2 steps
      if (nextStep.selector.includes('comp-split')) {
        document.querySelector<HTMLButtonElement>('button[data-tour-id="comp-split"]')?.click()
      } else if (nextStep.selector.includes('comp-blink')) {
        document.querySelector<HTMLButtonElement>('button[data-tour-id="comp-blink"]')?.click()
      } else if (nextStep.selector.includes('comp-vector')) {
        document.querySelector<HTMLButtonElement>('button[data-tour-id="comp-vector"]')?.click()
      }

      // Robust adaptive polling to lock onto target as soon as DOM element is rendered
      let attempts = 0
      const pollAndPosition = () => {
        const el = findTargetElement(nextStep.selector)
        if (el) {
          const b = el.getBoundingClientRect()
          if (b.width > 0 && b.height > 0) {
            try {
              el.scrollIntoView({ behavior: 'auto', block: 'center' })
            } catch {
              // Safe fallback
            }
            updatePositions(nextStep)
            timerRef.current = setTimeout(() => {
              updatePositions(nextStep)
              setIsStepTransition(false)
            }, 180)
            return
          }
        }
        if (attempts++ < 25) {
          pollingRef.current = setTimeout(pollAndPosition, 40)
        } else {
          updatePositions(nextStep)
          setIsStepTransition(false)
        }
      }

      // Start polling after slight yield for React render pipeline
      pollingRef.current = setTimeout(pollAndPosition, 50)
    },
    [currentMode, onSelectMode, updatePositions],
  )

  // When modal opens, initialize with initialStepIndex and sync mode
  useEffect(() => {
    if (isOpen) {
      const startIdx = Math.max(0, Math.min(BRIEFING_STEPS.length - 1, initialStepIndex))
      setCurrentStepIndex(startIdx)
      const targetStep = BRIEFING_STEPS[startIdx]
      if (currentMode !== targetStep.mode) {
        onSelectMode(targetStep.mode)
      }
      setIsStepTransition(true)

      let attempts = 0
      const pollFirst = () => {
        const el = findTargetElement(targetStep.selector)
        if (el) {
          const b = el.getBoundingClientRect()
          if (b.width > 0 && b.height > 0) {
            try {
              el.scrollIntoView({ behavior: 'auto', block: 'center' })
            } catch {
              // Safe fallback
            }
            updatePositions(targetStep)
            setTimeout(() => {
              updatePositions(targetStep)
              setIsStepTransition(false)
            }, 180)
            return
          }
        }
        if (attempts++ < 25) {
          pollingRef.current = setTimeout(pollFirst, 40)
        } else {
          updatePositions(targetStep)
          setIsStepTransition(false)
        }
      }
      pollingRef.current = setTimeout(pollFirst, 50)

      return () => {
        if (timerRef.current) clearTimeout(timerRef.current)
        if (pollingRef.current) clearTimeout(pollingRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialStepIndex])

  // Real-time tracking during user scroll or window resize (throttled with requestAnimationFrame for 60fps)
  useEffect(() => {
    if (!isOpen) return

    updatePositions()
    const t = setTimeout(() => {
      updatePositions()
    }, 350)

    let rafId: number | null = null
    const handleScrollOrResize = () => {
      if (rafId !== null) return
      rafId = requestAnimationFrame(() => {
        rafId = null
        updatePositions()
      })
    }

    window.addEventListener('resize', handleScrollOrResize, { passive: true })
    window.addEventListener('scroll', handleScrollOrResize, { passive: true })

    return () => {
      clearTimeout(t)
      if (rafId !== null) cancelAnimationFrame(rafId)
      window.removeEventListener('resize', handleScrollOrResize)
      window.removeEventListener('scroll', handleScrollOrResize)
    }
  }, [isOpen, currentStepIndex, updatePositions])

  // Mark completed in localStorage and close
  const handleClose = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_BRIEFING_COMPLETED, 'true')
      } catch {
        // Safe localStorage fallback
      }
    }
    playTone('select')
    onClose()
  }, [onClose])

  const handleNext = useCallback(() => {
    if (isLastStep) {
      handleClose()
    } else {
      playTone('select')
      goToStep(currentStepIndex + 1)
    }
  }, [isLastStep, handleClose, goToStep, currentStepIndex])

  const handlePrev = useCallback(() => {
    if (currentStepIndex > 0) {
      playTone('hover')
      goToStep(currentStepIndex - 1)
    }
  }, [currentStepIndex, goToStep])

  // Keyboard navigation: ArrowRight / Enter -> Next, ArrowLeft -> Prev, Escape -> Skip
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        handleClose()
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault()
        handleNext()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        handlePrev()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleClose, handleNext, handlePrev])

  if (!isOpen) return null

  const stepTitle =
    t(currentStep.titleKey, lang === 'ru' ? currentStep.titleRu : currentStep.titleEn)
  const stepDesc =
    t(currentStep.descKey, lang === 'ru' ? currentStep.descRu : currentStep.descEn)
  const stepTag =
    t(currentStep.tagKey, lang === 'ru' ? currentStep.tagRu : currentStep.tagEn)

  return (
    <div
      className="mission-briefing-overlay"
      role="dialog"
      aria-modal="false"
      aria-label="Mission Briefing Onboarding Tour"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 900,
        pointerEvents: 'none', // Allows free mouse wheel / touch page scrolling!
      }}
    >
      {/* Optical Spotlight Frame */}
      {spotlightRect && (
        <div
          className={`briefing-spotlight ${isStepTransition ? 'is-step-transition' : ''}`}
          style={{
            position: 'fixed',
            left: `${spotlightRect.x}px`,
            top: `${spotlightRect.y}px`,
            width: `${spotlightRect.width}px`,
            height: `${spotlightRect.height}px`,
            border: '1px solid #FFFFFF',
            boxShadow:
              '0 0 0 9999px rgba(0, 0, 0, 0.78), inset 0 0 24px rgba(255, 255, 255, 0.05)',
            pointerEvents: 'none',
            zIndex: 910,
          }}
        >
          {/* 4 Corner Ticks (+) */}
          <span className="spotlight-tick tick-tl">+</span>
          <span className="spotlight-tick tick-tr">+</span>
          <span className="spotlight-tick tick-bl">+</span>
          <span className="spotlight-tick tick-br">+</span>
        </div>
      )}

      {/* Floating Briefing Card */}
      <div
        className={`briefing-card ${isStepTransition ? 'is-step-transition' : ''}`}
        style={{
          position: 'fixed',
          top: `${cardPos.top}px`,
          left: `${cardPos.left}px`,
          pointerEvents: 'auto', // Card elements are fully clickable
          width: 'calc(100vw - 32px)',
          maxWidth: '400px',
          padding: '22px 24px',
          background: '#000000',
          border: '1px solid #FFFFFF',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          boxShadow: '0 16px 48px rgba(0, 0, 0, 0.95), 0 0 1px #FFFFFF',
          zIndex: 920,
          color: '#FFFFFF',
          boxSizing: 'border-box',
          opacity: isStepTransition ? 0.6 : 1,
        }}
      >
        {/* Card Header: Mode Tag & Close Icon */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              font: '10px var(--font-mono)',
              letterSpacing: '1.5px',
              color: 'rgba(255, 255, 255, 0.65)',
              textTransform: 'uppercase',
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#FFFFFF',
                boxShadow: '0 0 6px #FFFFFF',
              }}
            />
            <span>{stepTag}</span>
          </div>

          <button
            type="button"
            className="briefing-close-btn"
            onClick={handleClose}
            aria-label={t('briefing.close', 'Close briefing')}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.5)',
              cursor: 'pointer',
              padding: '2px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'color 200ms ease',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Step Counter: TAB 02 // STEP 01 OF 11 */}
        <div
          style={{
            marginBottom: '8px',
            font: '10px var(--font-mono)',
            fontWeight: 600,
            letterSpacing: '1.5px',
            color: 'rgba(255, 255, 255, 0.5)',
            textTransform: 'uppercase',
          }}
        >
          {currentStep.tabNumber} // STEP {String(currentStepIndex + 1).padStart(2, '0')} OF{' '}
          {String(BRIEFING_STEPS.length).padStart(2, '0')}
        </div>

        {/* Step Title */}
        <h3
          style={{
            margin: '0 0 10px',
            font: '14px var(--font-mono)',
            fontWeight: 700,
            letterSpacing: '1px',
            color: '#FFFFFF',
            textTransform: 'uppercase',
            lineHeight: 1.3,
          }}
        >
          {stepTitle}
        </h3>

        {/* Step Description */}
        <p
          style={{
            margin: '0 0 20px',
            font: '12px/1.65 var(--font-mono)',
            color: 'rgba(255, 255, 255, 0.78)',
            letterSpacing: '0.3px',
          }}
        >
          {stepDesc}
        </p>

        {/* Card Footer: Action Buttons */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '16px',
            borderTop: '1px solid rgba(255, 255, 255, 0.16)',
          }}
        >
          {/* Navigation Controls: PREV & SKIP */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {currentStepIndex > 0 ? (
              <button
                type="button"
                className="button-quiet"
                onClick={handlePrev}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.75)',
                  font: '10px var(--font-mono)',
                  letterSpacing: '1.2px',
                  padding: '6px 8px',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <ArrowLeft size={12} />
                <span>{t('briefing.prev', 'PREV')}</span>
              </button>
            ) : null}

            <button
              type="button"
              className="button-quiet"
              onClick={handleClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.5)',
                font: '10px var(--font-mono)',
                letterSpacing: '1.2px',
                padding: '6px 8px',
                cursor: 'pointer',
                textTransform: 'uppercase',
              }}
            >
              {t('briefing.skip', 'SKIP')}
            </button>
          </div>

          {/* NEXT / LAUNCH Button */}
          <button
            type="button"
            className="briefing-next-btn"
            onClick={handleNext}
            style={{
              background: '#FFFFFF',
              color: '#000000',
              border: '1px solid #FFFFFF',
              borderRadius: '9999px',
              font: '10px var(--font-mono)',
              fontWeight: 700,
              letterSpacing: '1.5px',
              padding: '7px 16px',
              cursor: 'pointer',
              textTransform: 'uppercase',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 200ms ease',
            }}
          >
            <span>
              {isLastStep
                ? t('briefing.launch', 'LAUNCH EXPLORER')
                : t('briefing.next', 'NEXT')}
            </span>
            {isLastStep ? <Check size={13} /> : <ArrowRight size={13} />}
          </button>
        </div>
      </div>
    </div>
  )
}

export default MissionBriefing
