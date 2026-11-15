import { lazy, Suspense, useEffect, useState } from 'react'
import { Orbit } from 'lucide-react'
import { Header } from './components/layout/Header'
import { MODES, type Mode } from './components/layout/modes'
import { TargetCarousel } from './components/carousel/TargetCarousel'
import { SkyExplorer } from './components/explorer/SkyExplorer'
import { CURATED_TARGETS, type EnhancedTarget } from './api/client'
import { usePipeline } from './hooks/usePipeline'
import { playTone, setAudioEnabled } from './utils/audio'
const CelestialSphereCanvas = lazy(() =>
  import('./components/3d/CelestialSphereCanvas').then((module) => ({
    default: module.CelestialSphereCanvas,
  })),
)
const SpectralLab = lazy(() =>
  import('./components/spectral/SpectralLab').then((module) => ({
    default: module.SpectralLab,
  })),
)
const ApertureModal = lazy(() =>
  import('./components/carousel/ApertureModal').then((module) => ({
    default: module.ApertureModal,
  })),
)
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
export const App = () => {
  const [initial] = useState(route),
    [mode, setMode] = useState<Mode>(initial.mode),
    [target, setTarget] = useState(initial.target)
  const [sound, setSound] = useState(false),
    [grid, setGrid] = useState(true),
    [semiMajor, setSemiMajor] = useState(600),
    [inclination, setInclination] = useState(30),
    [animateOrbit, setAnimateOrbit] = useState(true)
  const pipeline = usePipeline()
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
    setMode(next)
    updateRoute(next)
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
  return (
    <div className={`mission-app ${grid ? 'hud-grid-enabled' : ''}`}>
      <a
        className="skip-link"
        href="#mission-main"
        onClick={(event) => {
          event.preventDefault()
          document.getElementById('mission-main')?.focus()
        }}
      >
        Skip to mission workspace
      </a>
      <div className="ambient-halo" aria-hidden="true" />
      <Header
        mode={mode}
        onMode={selectMode}
        sound={sound}
        onSound={() => setSound(setAudioEnabled(!sound))}
        grid={grid}
        onGrid={() => setGrid((old) => !old)}
      />
      <main
        id="mission-main"
        className={`mission-main mode-${mode}`}
        tabIndex={-1}
      >
        <Suspense
          fallback={
            <div className="workspace-loading" role="status">
              <Orbit size={34} />
              <span>INITIALIZING WORKSPACE</span>
            </div>
          }
        >
          {mode === 'vault' && (
            <div className="vault-mode mode-content">
              <div className="vault-layout">
                <section className="vault-narrative">
                  <div className="eyebrow">
                    <span className="status-dot" />
                    TIME-DOMAIN SKY EXPLORER
                  </div>
                  <h1>
                    The sky
                    <br />
                    doesn't
                    <br />
                    <em>stand still.</em>
                  </h1>
                  <p className="hero-description">
                    A universe in motion.
                    <br />
                    Find the signal between the moments.
                  </p>
                  <button
                    className="hero-cta-capsule"
                    onClick={() => selectMode('explorer')}
                  >
                    EXPLORE ARCHIVE -&gt;
                  </button>
                </section>
                <section className="vault-window" aria-label="Celestial vault">
                  <CelestialSphereCanvas
                    target={target}
                    onSelect={selectTarget}
                    semiMajor={semiMajor}
                    inclination={inclination}
                    animated={animateOrbit}
                  />
                </section>
              </div>
              <TargetCarousel target={target} onSelect={selectTarget} />
            </div>
          )}
          {mode === 'comparator' && (
            <>
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
              />
            </>
          )}
          {mode === 'spectral' && <SpectralLab initialTarget={target} />}
          {mode === 'explorer' && (
            <SkyExplorer
              key={target.id}
              initialTarget={target}
              pipeline={pipeline}
              onTarget={selectTarget}
            />
          )}
        </Suspense>
      </main>
      <footer className="mission-footer">
        <span>
          <i className={busy ? 'status-dot working' : 'status-dot'} />
          {busy ? 'PIPELINE ACTIVE' : 'WORKSPACE READY'}
          <span className="footer-divider">/</span>ARCHIVAL DATA · NOT LIVE
          SPACECRAFT TELEMETRY
        </span>
        <span>
          MONOCHROME / SPACE APPS 2026 <span className="footer-divider">+</span>
          ICRS EQUATORIAL
        </span>
      </footer>
    </div>
  )
}
export default App
