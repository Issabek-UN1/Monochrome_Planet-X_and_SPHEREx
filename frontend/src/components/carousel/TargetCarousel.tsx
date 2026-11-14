import { useEffect, useRef } from 'react'
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Crosshair,
} from 'lucide-react'
import { CURATED_TARGETS, type EnhancedTarget } from '../../api/client'
import { formatDec, formatRA } from '../../utils/astronomy'
import { playTone } from '../../utils/audio'
export function TargetCarousel({
  target,
  onSelect,
}: {
  target: EnhancedTarget
  onSelect: (target: EnhancedTarget) => void
}) {
  const rail = useRef<HTMLDivElement>(null)
  const index = CURATED_TARGETS.findIndex((item) => item.id === target.id)
  useEffect(() => {
    const card = rail.current?.querySelector<HTMLElement>(
      `[data-target="${target.id}"]`,
    )
    if (card && rail.current)
      rail.current.scrollTo({
        left:
          card.offsetLeft -
          rail.current.offsetLeft -
          (rail.current.clientWidth - card.clientWidth) / 2,
        behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)')
          .matches
          ? 'instant'
          : 'smooth',
      })
  }, [target.id])
  function step(direction: number) {
    playTone('select')
    onSelect(
      CURATED_TARGETS[
        (index + direction + CURATED_TARGETS.length) % CURATED_TARGETS.length
      ],
    )
  }
  return (
    <section className="target-rail-section" aria-label="Challenge targets">
      <div className="section-label">
        <span>CATALOG / 05 CHALLENGE FIELDS</span>
        <div>
          <button
            className="icon-button"
            onClick={() => step(-1)}
            aria-label="Previous target"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            className="icon-button"
            onClick={() => step(1)}
            aria-label="Next target"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div className="target-rail" ref={rail}>
        {CURATED_TARGETS.map((item, itemIndex) => (
          <button
            key={item.id}
            data-target={item.id}
            className={`target-card ${item.id === target.id ? 'selected' : ''}`}
            aria-pressed={item.id === target.id}
            onClick={() => {
              playTone('select')
              onSelect(item)
            }}
            onPointerEnter={() => playTone('hover')}
          >
            <div className="target-card-top">
              <span>FIELD / 0{itemIndex + 1}</span>
              <ArrowUpRight size={15} />
            </div>
            <div className="card-reticle" aria-hidden="true">
              <Crosshair />
              <span>{String(itemIndex + 1).padStart(2, '0')}</span>
            </div>
            <strong>{item.name}</strong>
            <small>{item.category}</small>
            <div className="target-coords">
              {formatRA(item.ra)}
              <br />
              {formatDec(item.dec)}
            </div>
            <div className="target-card-bottom">
              <span>ICRS REFERENCE</span>
              <span className="status-dot" />
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}
