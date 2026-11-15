import { useEffect, useRef, useState } from 'react'
import { Orbit } from 'lucide-react'
import type { Capabilities } from '@monochrome-spherex/api-client'
import { spherexApi } from '../../api/client'
import { MODES, type Mode } from './modes'
import { useI18n } from '../../i18n'

interface Props {
  mode: Mode
  onMode: (mode: Mode) => void
  sound: boolean
  onSound: () => void
  grid: boolean
  onGrid: () => void
  minimal?: boolean
  onOpenBriefing?: () => void
}

export function Header({
  mode,
  onMode,
  sound,
  onSound,
  grid,
  onGrid,
  minimal = false,
  onOpenBriefing,
}: Props) {
  const { lang, setLang, t } = useI18n()
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null)
  const navRef = useRef<HTMLElement | null>(null)
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number }>({
    left: 0,
    width: 0,
  })

  useEffect(() => {
    const controller = new AbortController()
    const refresh = () =>
      spherexApi
        .capabilities(controller.signal)
        .then((value) => {
          if (!controller.signal.aborted) setCapabilities(value)
        })
        .catch(() => {
          if (!controller.signal.aborted) setCapabilities(null)
        })
    void refresh()
    const timer = setInterval(() => void refresh(), 15000)
    return () => {
      controller.abort()
      clearInterval(timer)
    }
  }, [])

  // Update sliding indicator bar position with high accuracy
  useEffect(() => {
    const updateIndicator = () => {
      if (!navRef.current) return
      const activeBtn = navRef.current.querySelector<HTMLButtonElement>(`[data-mode="${mode}"]`)
      if (activeBtn) {
        setIndicatorStyle({
          left: activeBtn.offsetLeft,
          width: activeBtn.offsetWidth,
        })
      }
    }

    updateIndicator()
    let resizeObserver: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined' && navRef.current) {
      resizeObserver = new ResizeObserver(updateIndicator)
      resizeObserver.observe(navRef.current)
    }
    window.addEventListener('resize', updateIndicator)
    return () => {
      if (resizeObserver) resizeObserver.disconnect()
      window.removeEventListener('resize', updateIndicator)
    }
  }, [mode, minimal])

  const live = capabilities?.provider === 'irsa'

  return (
    <header className="command-deck">
      <div className="deck-bar">
        <div className="brand-group">
          <a
            className="brand"
            href="#vault"
            onClick={(event) => {
              event.preventDefault()
              onMode('vault')
            }}
            aria-label="Monochrome orbital vault"
          >
            <span className="brand-mark">
              <Orbit size={20} />
            </span>
            <span>MONOCHROME</span>
          </a>
          <button
            type="button"
            className="briefing-trigger-pill"
            onClick={onOpenBriefing}
            aria-label={t('briefing.triggerAria', 'Open mission briefing tour')}
            title={t('briefing.triggerAria', 'Open mission briefing tour')}
          >
            <span>{t('briefing.trigger', 'BRIEFING')}</span>
          </button>
        </div>
        <nav
          className={`mode-nav ${minimal ? 'mode-nav-hidden' : 'mode-nav-visible'}`}
          ref={navRef}
          aria-label="Mission modes"
        >
          {MODES.map((item, index) => (
            <button
              key={item.id}
              data-mode={item.id}
              className={`mode-button ${mode === item.id ? 'active' : ''}`}
              aria-current={mode === item.id ? 'page' : undefined}
              onClick={() => onMode(item.id)}
            >
              <span className="mode-index">0{index + 1}</span>
              <item.icon size={15} />
              <span>{t(`modes.${item.id}`, item.label)}</span>
            </button>
          ))}
          <span
            className="mode-indicator-bar mode-nav-slider active-tab-indicator"
            style={{
              transform: `translateX(${indicatorStyle.left}px)`,
              width: `${indicatorStyle.width}px`,
            }}
            aria-hidden="true"
          />
        </nav>
        <div className="deck-actions">
          <button
            type="button"
            className="lang-toggle-button"
            onClick={() => setLang(lang === 'en' ? 'ru' : 'en')}
            aria-label={lang === 'en' ? 'Переключить на русский язык' : 'Switch to English'}
            title={lang === 'en' ? 'Переключить на русский язык' : 'Switch to English'}
          >
            <span className={`lang-opt ${lang === 'en' ? 'active' : ''}`}>EN</span>
            <span className="lang-slash">/</span>
            <span className={`lang-opt ${lang === 'ru' ? 'active' : ''}`}>RU</span>
          </button>
        </div>
      </div>

      {/* Screen reader & test contract accessibility */}
      <div className="sr-only">
        <div
          className={`provider-status-text ${!capabilities ? 'offline' : live ? '' : 'demo'}`}
          role="status"
        >
          <span>
            {!capabilities
              ? t('header.apiUnavailable')
              : live
                ? t('header.irsaRealData')
                : t('header.syntheticDemo')}
          </span>
        </div>
        <button
          onClick={onSound}
          aria-pressed={sound}
          aria-label={sound ? t('header.soundMute') : t('header.soundEnable')}
        >
          {sound ? t('header.soundMute') : t('header.soundEnable')}
        </button>
        <button
          onClick={onGrid}
          aria-pressed={grid}
          aria-label={t('header.gridToggle')}
        >
          {grid ? t('header.gridOn') : t('header.gridOff')}
        </button>
      </div>
    </header>
  )
}
