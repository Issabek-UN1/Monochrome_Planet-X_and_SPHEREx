import React, { useState } from 'react'
import { ArrowRight, ExternalLink, Globe, Sparkles } from 'lucide-react'
import { CelestialSphereCanvas } from './components/3d/CelestialSphereCanvas'
import { AugeCarousel } from './components/carousel/AugeCarousel'
import { ApertureModal } from './components/carousel/ApertureModal'
import { Header, type TabType } from './components/header/Header'
import { SkyExplorer } from './components/explorer/SkyExplorer'
import { SpectralLab } from './components/spectral/SpectralLab'
import { TargetingCursor } from './components/cursor/TargetingCursor'
import { CURATED_TARGETS, type EnhancedTarget } from './api/client'

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<TabType>('overview')
  const [selectedTarget, setSelectedTarget] = useState<EnhancedTarget | null>(CURATED_TARGETS[0])
  const [activeCarouselTarget, setActiveCarouselTarget] = useState<EnhancedTarget>(CURATED_TARGETS[0])
  const [inspectModalTarget, setInspectModalTarget] = useState<EnhancedTarget | null>(null)

  const handleSelectTargetFromCarousel = (target: EnhancedTarget) => {
    setSelectedTarget(target)
    setCurrentTab('explorer')
  }

  const handleInspectTargetFromCarousel = (target: EnhancedTarget) => {
    setInspectModalTarget(target)
  }

  return (
    <div className="relative min-h-screen bg-[#030305] text-neutral-100 flex flex-col font-sans selection:bg-amber-500/30 selection:text-amber-200">
      {/* Sci-Fi Celestial Targeting Reticle */}
      <TargetingCursor />

      {/* High-Res Split-Wipe Modal */}
      <ApertureModal
        target={inspectModalTarget}
        onClose={() => setInspectModalTarget(null)}
        onOpenExplorer={(t) => {
          setSelectedTarget(t)
          setCurrentTab('explorer')
        }}
        onOpenSpectral={(t) => {
          setSelectedTarget(t)
          setCurrentTab('spectral')
        }}
      />

      {/* HUD Header */}
      <Header currentTab={currentTab} onSelectTab={setCurrentTab} />

      {/* Main Tab Content */}
      <main className="relative flex-1">
        {currentTab === 'overview' && (
          <div className="relative min-h-[calc(100vh-64px)] flex flex-col justify-between overflow-hidden">
            {/* 3D WebGL Background: SPHEREx Wireframe Celestial Sphere + Tilted Orbit */}
            <CelestialSphereCanvas
              targetRa={activeCarouselTarget.ra}
              targetDec={activeCarouselTarget.dec}
            />

            {/* Hero Top Narrative */}
            <div className="relative z-10 mx-auto max-w-5xl px-6 pt-10 pb-2 text-center">
              <div className="inline-flex items-center space-x-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 font-mono text-xs text-amber-300">
                <Sparkles className="h-3.5 w-3.5 animate-spin" style={{ animationDuration: '4s' }} />
                <span>NASA SPACE APPS CHALLENGE 2026 // PLANET X & SPHEREx</span>
              </div>

              <h1 className="mt-4 text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white uppercase">
                Mapping the Unseen Sky
              </h1>

              <p className="mx-auto mt-3 max-w-2xl text-base sm:text-lg text-neutral-400 font-sans leading-relaxed">
                NASA's SPHEREx maps the entire sky every six months in 102 infrared colors.
                Track moving objects between survey epochs to uncover brown dwarfs and the elusive Planet X.
              </p>

              {/* Fast Stats Bar */}
              <div className="mx-auto mt-5 flex max-w-2xl items-center justify-around border-y border-white/10 py-3 font-mono text-xs">
                <div>
                  <span className="block text-base font-bold text-amber-400">102</span>
                  <span className="text-[10px] text-neutral-400">INFRARED BANDS</span>
                </div>
                <div className="h-6 border-r border-white/10" />
                <div>
                  <span className="block text-base font-bold text-cyan-400">6 MONTHS</span>
                  <span className="text-[10px] text-neutral-400">SURVEY CADENCE</span>
                </div>
                <div className="h-6 border-r border-white/10" />
                <div>
                  <span className="block text-base font-bold text-purple-400">1.4B+</span>
                  <span className="text-[10px] text-neutral-400">CATALOGED OBJECTS</span>
                </div>
                <div className="h-6 border-r border-white/10" />
                <div>
                  <span className="block text-base font-bold text-emerald-400">5 TARGETS</span>
                  <span className="text-[10px] text-neutral-400">OFFICIAL BENCHMARKS</span>
                </div>
              </div>
            </div>

            {/* Auge XP Kinetic Carousel */}
            <AugeCarousel
              onSelectTarget={handleSelectTargetFromCarousel}
              onInspectTarget={handleInspectTargetFromCarousel}
              onActiveTargetChange={setActiveCarouselTarget}
            />

            {/* Bottom Quick Bar */}
            <div className="relative z-10 border-t border-white/10 bg-black/40 px-6 py-4 backdrop-blur-md">
              <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 sm:flex-row font-mono text-xs text-neutral-400">
                <div className="flex items-center space-x-2">
                  <Globe className="h-4 w-4 text-cyan-400" />
                  <span>
                    Sphere Beacon Lock: RA {activeCarouselTarget.ra.toFixed(2)}° / DEC{' '}
                    {activeCarouselTarget.dec.toFixed(2)}° ({activeCarouselTarget.name})
                  </span>
                </div>

                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => setCurrentTab('explorer')}
                    className="flex items-center space-x-1.5 text-amber-400 hover:text-amber-300 transition-colors"
                  >
                    <span>OPEN SKY EXPLORER</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                  <span>•</span>
                  <button
                    onClick={() => setCurrentTab('spectral')}
                    className="flex items-center space-x-1.5 text-purple-400 hover:text-purple-300 transition-colors"
                  >
                    <span>INSPECT 102 BANDS</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentTab === 'explorer' && <SkyExplorer initialTarget={selectedTarget} />}
        {currentTab === 'spectral' && <SpectralLab initialTarget={selectedTarget} />}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-neutral-950 py-6 px-6 font-mono text-xs text-neutral-400">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <span className="text-white font-semibold">Monochrome SPHEREx</span> — NASA Space Apps Challenge 2026.
            <span className="block text-[11px] text-neutral-400">
              Built with FastAPI, SPHEREx IRSA / Synthetic Demo Provider, and Three.js.
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <a
              href="https://github.com/Issabek-UN1/Monochrome_Planet-X_and_SPHEREx/tree/Furfar"
              target="_blank"
              rel="noreferrer"
              className="flex items-center space-x-1 hover:text-amber-300 transition-colors"
            >
              <span>GitHub (Furfar)</span>
              <ExternalLink className="h-3 w-3" />
            </a>
            <span>•</span>
            <a
              href="https://www.spaceappschallenge.org/2026/challenges/planet-x-and-spherex/"
              target="_blank"
              rel="noreferrer"
              className="flex items-center space-x-1 hover:text-cyan-300 transition-colors"
            >
              <span>NASA Challenge Details</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
