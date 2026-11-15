import React, { useEffect, useRef, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import type { Mode } from '../layout/modes'
import { playTone } from '../../utils/audio'
import { useI18n } from '../../i18n'

export interface DirectoryItem {
  index: string
  mode: Mode
  title: string
  description: string
}

const DIRECTORY_ITEMS: DirectoryItem[] = [
  {
    index: '02',
    mode: 'comparator',
    title: 'TARGET COMPARATOR',
    description: 'Multi-epoch blink comparison & Planet X hypothesis sliders',
  },
  {
    index: '03',
    mode: 'spectral',
    title: 'SPECTRAL LAB',
    description: 'SPHEREx infrared spectral energy distribution analysis',
  },
  {
    index: '04',
    mode: 'explorer',
    title: 'LIVE EXPLORER',
    description: 'Real-time IRSA sky coordinate & proper motion lookup',
  },
]

export interface VaultDirectoryProps {
  onSelectMode: (mode: Mode) => void
  className?: string
}

export const VaultDirectory: React.FC<VaultDirectoryProps> = ({
  onSelectMode,
  className = '',
}) => {
  const { t } = useI18n()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [inView, setInView] = useState(() => {
    return typeof window === 'undefined' || !('IntersectionObserver' in window)
  })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    if (typeof window !== 'undefined' && 'IntersectionObserver' in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setInView(true)
            }
          })
        },
        {
          threshold: 0.12,
          rootMargin: '0px 0px -40px 0px',
        },
      )
      observer.observe(el)
      return () => observer.disconnect()
    }
  }, [])

  const handleRowClick = (mode: Mode) => {
    playTone('select')
    onSelectMode(mode)
  }

  return (
    <div
      ref={containerRef}
      className={`vault-directory-container ${inView ? 'is-revealed' : ''} ${className}`.trim()}
    >
      <header className="vault-directory-header">
        <div className="eyebrow">
          <span className="status-dot" />
          <span>INSTRUMENT DIRECTORY</span>
        </div>
        <span className="vault-directory-meta">
          02 — 04 / CHRONOLOGICAL EXPLORATION SUITE
        </span>
      </header>

      <nav className="vault-directory-list" aria-label="App sections directory">
        {DIRECTORY_ITEMS.map((item, i) => {
          return (
            <a
              key={item.index}
              href={`#${item.mode}`}
              className={`vault-directory-row ${inView ? 'in-view' : ''}`}
              style={{
                transitionDelay: `${i * 80}ms`,
              }}
              onClick={(e) => {
                e.preventDefault()
                handleRowClick(item.mode)
              }}
              onMouseEnter={() => playTone('hover')}
              aria-label={`${item.index} / ${t(`directory.${item.mode}.title`, item.title)} — ${t(`directory.${item.mode}.desc`, item.description)}`}
            >
              <div className="vault-directory-row-left">
                <span className="vault-directory-index">{item.index}</span>
                <span className="vault-directory-sep">/</span>
                <div className="vault-directory-title-block">
                  <span className="vault-directory-title">
                    {t(`directory.${item.mode}.title`, item.title)}
                  </span>
                  <span className="vault-directory-desc">
                    {t(`directory.${item.mode}.desc`, item.description)}
                  </span>
                </div>
              </div>

              <div className="vault-directory-row-right">
                <span className="vault-directory-arrow" aria-hidden="true">
                  <ArrowRight size={18} />
                </span>
              </div>
            </a>
          )
        })}
      </nav>
    </div>
  )
}

export default VaultDirectory
