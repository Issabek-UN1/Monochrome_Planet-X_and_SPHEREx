import { useEffect, useRef, useState } from 'react'
import { Orbit } from 'lucide-react'
import type { Capabilities } from '@monochrome-spherex/api-client'
import { spherexApi } from '../../api/client'
import { MODES, type Mode } from './modes'

interface Props {
  mode: Mode
  onMode: (mode: Mode) => void
  sound: boolean
  onSound: () => void
  grid: boolean
  onGrid: () => void
  minimal?: boolean
}

export function Header({
  mode,
  onMode,
  sound,
  onSound,
  grid,
  onGrid,
  minimal = false,
}: Props) {
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
    window.addEventListener('resize', updateIndicator)
    return () => window.removeEventListener('resize', updateIndicator)
  }, [mode, minimal])

  const live = capabilities?.provider === 'irsa'

  return (
    <header className="command-deck">
      <div className="deck-bar">
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
              <span>{item.label}</span>
            </button>
          ))}
          <span
            className="mode-indicator-bar"
            style={{
              transform: `translateX(${indicatorStyle.left}px)`,
              width: `${indicatorStyle.width}px`,
            }}
            aria-hidden="true"
          />
        </nav>
      </div>

      {/* Screen reader & test contract accessibility */}
      <div className="sr-only">
        <div
          className={`provider-status-text ${!capabilities ? 'offline' : live ? '' : 'demo'}`}
          role="status"
        >
          <span>
            {!capabilities
              ? 'API UNAVAILABLE'
              : live
                ? 'IRSA REAL DATA'
                : 'SYNTHETIC DEMO'}
          </span>
        </div>
        <button
          onClick={onSound}
          aria-pressed={sound}
          aria-label={sound ? 'Mute sound effects' : 'Enable sound effects'}
        >
          {sound ? 'Mute sound effects' : 'Enable sound effects'}
        </button>
        <button
          onClick={onGrid}
          aria-pressed={grid}
          aria-label="Toggle HUD grid"
        >
          {grid ? 'Grid On' : 'Grid Off'}
        </button>
      </div>
    </header>
  )
}
