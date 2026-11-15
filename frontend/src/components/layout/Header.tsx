import { useEffect, useState } from 'react'
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
}

export function Header({ mode, onMode, sound, onSound, grid, onGrid }: Props) {
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null)

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
        <nav aria-label="Mission modes">
          {MODES.map((item, index) => (
            <button
              key={item.id}
              className={`mode-button ${mode === item.id ? 'active' : ''}`}
              aria-current={mode === item.id ? 'page' : undefined}
              onClick={() => onMode(item.id)}
            >
              <span className="mode-index">0{index + 1}</span>
              <item.icon size={15} />
              <span>{item.label}</span>
            </button>
          ))}
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
