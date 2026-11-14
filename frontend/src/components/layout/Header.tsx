import { useEffect, useState } from 'react'
import {
  Activity,
  AudioLines,
  Grid2X2,
  Orbit,
  Radio,
  VolumeX,
} from 'lucide-react'
import type { Capabilities } from '@monochrome-spherex/api-client'
import { spherexApi } from '../../api/client'
import { mjdNow } from '../../utils/astronomy'
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
  const [mjd, setMjd] = useState(mjdNow())
  useEffect(() => {
    const timer = setInterval(() => setMjd(mjdNow()), 1000)
    return () => clearInterval(timer)
  }, [])
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
      <div className="deck-top">
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
            <Orbit size={25} />
          </span>
          <span>
            MONOCHROME<small>PLANET X / SPHEREx</small>
          </span>
        </a>
        <div className="mission-track">
          <Radio size={14} />
          <span>
            SPHEREx<small>650 KM · SUN-SYNCHRONOUS ORBIT</small>
          </span>
          <span className="track-divider" />
          <span>
            NEOSSat<small>OPTICAL ARCHIVE · CADC</small>
          </span>
        </div>
        <div className="deck-actions">
          <div className="clock">
            <small>MISSION TIME / MJD</small>
            <span>{mjd.toFixed(5)}</span>
          </div>
          <button
            className="icon-button"
            onClick={onGrid}
            aria-pressed={grid}
            aria-label="Toggle HUD grid"
          >
            <Grid2X2 size={17} />
          </button>
          <button
            className="icon-button"
            onClick={onSound}
            aria-pressed={sound}
            aria-label={sound ? 'Mute sound effects' : 'Enable sound effects'}
          >
            {sound ? <AudioLines size={18} /> : <VolumeX size={18} />}
          </button>
        </div>
      </div>
      <div className="deck-bottom">
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
        <div
          className={`provider-tag ${!capabilities ? 'offline' : live ? '' : 'demo'}`}
          role="status"
        >
          <Activity size={14} />
          {!capabilities
            ? 'API UNAVAILABLE'
            : live
              ? 'IRSA REAL DATA'
              : 'SYNTHETIC DEMO'}
          <span className="status-dot" />
        </div>
      </div>
    </header>
  )
}
