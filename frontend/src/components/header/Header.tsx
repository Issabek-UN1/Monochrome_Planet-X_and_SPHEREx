import React, { useEffect, useState } from 'react'
import { Activity, Compass, ExternalLink, Layers, Search, Sparkles } from 'lucide-react'
import { spherexApi } from '../../api/client'
import type { Capabilities } from '@monochrome-spherex/api-client'

export type TabType = 'overview' | 'explorer' | 'spectral'

interface HeaderProps {
  currentTab: TabType
  onSelectTab: (tab: TabType) => void
}

export const Header: React.FC<HeaderProps> = ({ currentTab, onSelectTab }) => {
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null)
  const [utcTime, setUtcTime] = useState('')

  // Live UTC Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setUtcTime(now.toUTCString().replace('GMT', 'UTC'))
    }
    updateTime()
    const timer = setInterval(updateTime, 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const refresh = () => spherexApi.capabilities(controller.signal).then(setCapabilities).catch(() => {
      if (!controller.signal.aborted) setCapabilities(null)
    })
    void refresh()
    const timer = setInterval(refresh, 10_000)
    return () => { controller.abort(); clearInterval(timer) }
  }, [])

  const isDemo = capabilities?.synthetic || capabilities?.provider === 'demo'

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-neutral-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        {/* Brand & Mission Tag */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-400">
              <Compass className="h-4 w-4 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-mono text-sm font-bold tracking-wider text-white">
                  MONOCHROME
                </span>
                <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-amber-300">
                  SPHEREx
                </span>
              </div>
              <p className="text-[10px] font-mono text-neutral-400">
                NASA Space Apps 2026 // Planet X Discovery
              </p>
            </div>
          </div>

          {/* Mode Badge (Demo vs Live IRSA) */}
          <div className="hidden lg:flex items-center space-x-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-mono">
            <span
              className={`h-2 w-2 rounded-full ${
                isDemo ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'
              }`}
            />
            <span className={isDemo ? 'text-amber-300' : 'text-emerald-400'}>
              {!capabilities ? 'API UNAVAILABLE' : isDemo ? 'SYNTHETIC DEMO MODE' : 'IRSA MODE (ARCHIVE STATUS MAY VARY)'}
            </span>
          </div>
        </div>

        {/* Central Navigation Tabs */}
        <nav className="flex items-center rounded-xl border border-white/10 bg-black/40 p-1 font-mono text-xs">
          <button
            onClick={() => onSelectTab('overview')}
            className={`flex items-center space-x-2 rounded-lg px-3.5 py-1.5 transition-all ${
              currentTab === 'overview'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>HORIZON CAROUSEL</span>
          </button>

          <button
            onClick={() => onSelectTab('explorer')}
            className={`flex items-center space-x-2 rounded-lg px-3.5 py-1.5 transition-all ${
              currentTab === 'explorer'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_15px_rgba(56,189,248,0.2)]'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Search className="h-3.5 w-3.5" />
            <span>SKY EXPLORER</span>
          </button>

          <button
            onClick={() => onSelectTab('spectral')}
            className={`flex items-center space-x-2 rounded-lg px-3.5 py-1.5 transition-all ${
              currentTab === 'spectral'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.2)]'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>102 SPECTRAL BANDS</span>
          </button>
        </nav>

        {/* Right Info: Live UTC Clock & External Link */}
        <div className="flex items-center space-x-4 font-mono text-xs text-neutral-400">
          <div className="hidden md:flex items-center space-x-1.5">
            <Activity className="h-3.5 w-3.5 text-cyan-400" />
            <span>{utcTime || 'UTC 12:00:00'}</span>
          </div>

          <a
            href="https://www.spaceappschallenge.org/2026/challenges/planet-x-and-spherex/?tab=details"
            target="_blank"
            rel="noreferrer"
            className="flex items-center space-x-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-neutral-300 hover:border-amber-500/50 hover:text-amber-300 transition-colors"
          >
            <span>CHALLENGE</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </header>
  )
}
