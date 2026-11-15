import { useEffect, useState } from 'react'
import { Header } from './components/layout/Header'
import { MODES, type Mode } from './components/layout/modes'
import { TargetCarousel } from './components/carousel/TargetCarousel'
import { SkyExplorer } from './components/explorer/SkyExplorer'
import { CURATED_TARGETS, type EnhancedTarget } from './api/client'
import { usePipeline } from './hooks/usePipeline'
import { playTone, setAudioEnabled } from './utils/audio'
import { StarfieldCanvas } from './components/3d/StarfieldCanvas'
import { VaultDirectory } from './components/vault/VaultDirectory'
import { CelestialSphereCanvas } from './components/3d/CelestialSphereCanvas'
import { SpectralLab } from './components/spectral/SpectralLab'
import { ApertureModal } from './components/carousel/ApertureModal'
import { MissionBriefing } from './components/tour/MissionBriefing'
import { I18nProvider, useI18n } from './i18n'

function route() {
  const url = new URL(window.location.href),
    ra = Number(url.searchParams.get('ra')),
    dec = Number(url.searchParams.get('dec'))
  let target =
    CURATED_TARGETS.find(
      (item) => item.id === url.searchParams.get('target'),
    ) ?? CURATED_TARGETS[0]
  const custom =
    url.searchParams.has('ra') &&
    url.searchParams.has('dec') &&
    Number.isFinite(ra) &&
    Number.isFinite(dec) &&
    ra >= 0 &&
    ra < 360 &&
    Math.abs(dec) <= 90
  if (custom && !url.searchParams.has('target'))
    target = {
      ...target,
      id: 'custom',
      name: 'Custom ICRS field',
      ra,
      dec,
      category: 'Custom Field',
      coordinate_source: url.href,
      description: 'Coordinates supplied in the URL.',
      notes: 'User-supplied field centre; no catalog classification.',
    }
  const mode =
    MODES.find((item) => item.id === url.hash.slice(1))?.id ??
    (custom ? 'explorer' : 'vault')
  return { target, mode }
}

const AppContent = () => {
  const { t } = useI18n()
  const [initial] = useState(route),
    [mode, setMode] = useState<Mode>(initial.mode),
    [target, setTarget] = useState(initial.target)
  const [sound, setSound] = useState(false),
    [grid, setGrid] = useState(true),
    [semiMajor, setSemiMajor] = useState(600),
    [inclination, setInclination] = useState(30),
    [animateOrbit, setAnimateOrbit] = useState(true)
  const [scrollY, setScrollY] = useState(0)
  const [isScrollingUp, setIsScrollingUp] = useState(false)
  const [briefingOpen, setBriefingOpen] = useState(false)
  const [briefingStep, setBriefingStep] = useState(0)
  const pipeline = usePipeline()

  const handleOpenBriefing = (stepIndex = 0) => {
    setBriefingStep(stepIndex)
    setBriefingOpen(true)
  }

  useEffect(() => {
    let lastScrollY = typeof window !== 'undefined' ? window.scrollY : 0
    const handleScroll = () => {
      const currentY = Math.max(0, window.scrollY || 0)
      setIsScrollingUp(currentY < lastScrollY && currentY > 0)
      setScrollY(currentY)
      lastScrollY = currentY
    }
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  function updateRoute(nextMode: Mode, nextTarget = target) {
    const url = new URL(window.location.href)
    url.hash = nextMode
    if (nextTarget.id === 'custom') {
      url.searchParams.delete('target')
      url.searchParams.set('ra', String(nextTarget.ra))
      url.searchParams.set('dec', String(nextTarget.dec))
    } else {
      url.searchParams.set('target', nextTarget.id)
      url.searchParams.delete('ra')
      url.searchParams.delete('dec')
    }
    window.history.pushState(null, '', url)
  }

  function selectMode(next: Mode) {
    playTone('hover')
    if (next === 'vault' && mode === 'vault') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setMode(next)
    updateRoute(next)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  function scrollToSection2() {
    playTone('select')
    const dir = document.getElementById('vault-directory-section')
    if (dir) {
      dir.scrollIntoView({ behavior: 'smooth' })
    } else {
      window.scrollTo({ top: window.innerHeight, behavior: 'smooth' })
    }
  }

  function selectTarget(next: EnhancedTarget) {
    if (next.id !== target.id) {
      pipeline.reset()
      setTarget(next)
      playTone('select')
      updateRoute(mode, next)
    }
  }

  const resetPipeline = pipeline.reset
  useEffect(() => {
    const back = () => {
      const next = route()
      setMode(next.mode)
      setTarget(next.target)
      resetPipeline()
    }
    window.addEventListener('popstate', back)
    return () => window.removeEventListener('popstate', back)
  }, [resetPipeline])

  useEffect(
    () => () => {
      setAudioEnabled(false)
    },
    [],
  )

  const busy = pipeline.busy
  const isMinimalHeader =
    mode === 'vault' && (scrollY < 200 || isScrollingUp)

  return (
    <div className={`mission-app ${grid ? 'hud-grid-enabled' : ''}`}>
      <StarfieldCanvas mode={mode} scrollY={scrollY} />
      <a
        className="skip-link"
        href="#mission-main"
        onClick={(event) => {
          event.preventDefault()
          document.getElementById('mission-main')?.focus()
        }}
      >
        {t('app.skipLink')}
      </a>
      <div className="ambient-halo" aria-hidden="true" />
      <Header
        mode={mode}
        onMode={selectMode}
        sound={sound}
        onSound={() => setSound(setAudioEnabled(!sound))}
        grid={grid}
        onGrid={() => setGrid((old) => !old)}
        minimal={isMinimalHeader}
        onOpenBriefing={() => handleOpenBriefing(0)}
      />
      <main
        id="mission-main"
        className={`mission-main mode-${mode}`}
        tabIndex={-1}
      >
        {mode === 'vault' && (
          <div className="vault-mode mode-content" key="vault">
              {/* SECTION 1: HERO VIEWPORT (100vh) */}
              <section className="vault-hero-section" aria-label="Mission hero">
                <div className="vault-layout">
                  <section className="vault-narrative">
                    <div className="eyebrow hero-stagger hero-stagger-1">
                      <span className="status-dot" />
                      {t('hero.eyebrow')}
                    </div>
                    <h1 className="hero-stagger hero-stagger-2">
                      {t('hero.titleLine1')}
                      <br />
                      {t('hero.titleLine2')}
                      <br />
                      <em>{t('hero.titleLine3')}</em>
                    </h1>
                    <p className="hero-description hero-stagger hero-stagger-3">
                      {t('hero.descLine1')}
                      <br />
                      {t('hero.descLine2')}
                    </p>
                    <button
                      className="hero-cta-capsule hero-stagger hero-stagger-4"
                      onClick={scrollToSection2}
                      aria-label="Explore archive: scroll to instrument directory"
                    >
                      {t('hero.cta')}
                    </button>
                  </section>
                  <section
                    className="vault-window"
                    aria-label="Celestial vault"
                    style={{
                      transform: `translateY(-${Math.min(50, scrollY * 0.1)}px)`,
                      opacity: Math.max(
                        0,
                        1 -
                          scrollY /
                            (typeof window !== 'undefined'
                              ? Math.max(window.innerHeight * 0.65, 300)
                              : 500),
                      ),
                      transition:
                        'opacity 0.1s ease-out, transform 0.1s ease-out',
                    }}
                  >
                    <CelestialSphereCanvas
                      target={target}
                      onSelect={selectTarget}
                      semiMajor={semiMajor}
                      inclination={inclination}
                      animated={animateOrbit}
                    />
                  </section>
                </div>
              </section>

              {/* SECTION 2: DEEP STARFIELD & VERTICAL TAB DIRECTORY (100vh) */}
              <section
                id="vault-directory-section"
                className="vault-directory-section"
                aria-label="Deep starfield and vertical directory"
              >
                <div className="vault-directory-inner">
                  <VaultDirectory
                    onSelectMode={selectMode}
                  />
                </div>
              </section>
            </div>
          )}
          {mode === 'comparator' && (
            <div className="mode-content" key="comparator">
              <div className="compact-catalog">
                <TargetCarousel target={target} onSelect={selectTarget} />
              </div>
              <ApertureModal
                key={target.id}
                target={target}
                pipeline={pipeline}
                semiMajor={semiMajor}
                onSemiMajor={setSemiMajor}
                inclination={inclination}
                onInclination={setInclination}
                animateOrbit={animateOrbit}
                onAnimateOrbit={setAnimateOrbit}
                onOpenBriefing={handleOpenBriefing}
              />
            </div>
          )}
          {mode === 'spectral' && (
            <div className="mode-content" key="spectral">
              <SpectralLab initialTarget={target} onOpenBriefing={handleOpenBriefing} />
            </div>
          )}
          {mode === 'explorer' && (
            <div className="mode-content" key="explorer">
              <SkyExplorer
                key={target.id}
                initialTarget={target}
                pipeline={pipeline}
                onTarget={selectTarget}
                onOpenBriefing={handleOpenBriefing}
              />
            </div>
          )}
      </main>
      <footer className="mission-footer">
        <span>
          <i className={busy ? 'status-dot working' : 'status-dot'} />
          {busy ? t('footer.pipelineActive') : t('footer.workspaceReady')}
          <span className="footer-divider">/</span>{t('footer.archivalData')}
        </span>
        <span>
          {t('footer.coords')}
        </span>
      </footer>
      <MissionBriefing
        isOpen={briefingOpen}
        initialStepIndex={briefingStep}
        onClose={() => setBriefingOpen(false)}
        onSelectMode={selectMode}
        currentMode={mode}
      />
    </div>
  )
}

export const App = () => (
  <I18nProvider>
    <AppContent />
  </I18nProvider>
)

export default App
