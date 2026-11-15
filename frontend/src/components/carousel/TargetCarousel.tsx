import React, { useEffect, useRef } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { CURATED_TARGETS, type EnhancedTarget } from '../../api/client'
import { playTone } from '../../utils/audio'
import { useI18n } from '../../i18n'

export type TargetId =
  | 'wise-0855'
  | 'barnards-star'
  | 'epsilon-indi-b'
  | 'rw-aurigae'
  | 'r-draconis'

export interface TargetCarouselProps {
  target?: EnhancedTarget | null
  activeTargetId?: TargetId | string | null
  onSelect?: (target: EnhancedTarget) => void
  onSelectTargetId?: (targetId: TargetId | string) => void
  className?: string
}

export const TargetCarousel: React.FC<TargetCarouselProps> = ({
  target,
  activeTargetId,
  onSelect,
  onSelectTargetId,
  className = '',
}) => {
  const { t } = useI18n()
  const rail = useRef<HTMLDivElement>(null)
  const currentActiveId = (activeTargetId ?? target?.id ?? 'wise-0855') as string

  useEffect(() => {
    const card = rail.current?.querySelector<HTMLElement>(
      `[data-target="${currentActiveId}"]`,
    )
    if (card && rail.current && typeof rail.current.scrollTo === 'function') {
      rail.current.scrollTo({
        left:
          card.offsetLeft -
          rail.current.offsetLeft -
          (rail.current.clientWidth - card.clientWidth) / 2,
        behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth',
      })
    }
  }, [currentActiveId])

  const handleSelect = (item: EnhancedTarget) => {
    playTone('select')
    onSelect?.(item)
    onSelectTargetId?.(item.id)
  }

  return (
    <section
      className={`target-rail-section ${className}`.trim()}
      aria-label={t('carousel.ariaLabel', 'Challenge targets')}
      data-tour-id="comp-targets"
    >
      <div className="target-rail" ref={rail}>
        {CURATED_TARGETS.map((item, itemIndex) => {
          const isSelected = item.id === currentActiveId
          return (
            <button
              key={item.id}
              data-target={item.id}
              data-target-id={item.id}
              className={`target-card hero-stagger ${isSelected ? 'selected' : ''}`}
              aria-pressed={isSelected}
              aria-current={isSelected ? 'true' : undefined}
              style={{
                animationDelay: `${240 + itemIndex * 60}ms`,
                ...(isSelected
                  ? {
                      borderColor: '#ffffff',
                      boxShadow: '0 0 0 1px #ffffff',
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    }
                  : {}),
              }}
              onClick={() => handleSelect(item)}
              onPointerEnter={() => playTone('hover')}
            >
              <div className="target-card-top">
                <span>{t('carousel.field', 'FIELD')} / 0{itemIndex + 1}</span>
                <ArrowUpRight size={14} className="target-card-arrow" />
              </div>
              <strong>{item.name}</strong>
              <small className="target-category-label">{t(`category.${item.category}`, item.category)}</small>
            </button>
          )
        })}
      </div>
    </section>
  )
}

export default TargetCarousel
