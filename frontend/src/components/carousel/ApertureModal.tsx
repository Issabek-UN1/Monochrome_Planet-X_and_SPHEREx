import { useEffect, useId, useRef, useState } from 'react'
import {
  ArrowLeftRight,
  Code2,
  Film,
  Maximize2,
  Minus,
  Pause,
  Play,
  ScanLine,
  X,
} from 'lucide-react'
import type { Artifact, Job } from '@monochrome-spherex/api-client'
import { type EnhancedTarget } from '../../api/client'
import type { Pipeline } from '../../hooks/usePipeline'
import {
  ArchiveImage,
  Downloads,
  FitsInspector,
} from '../common/ArtifactViewer'
import { ErrorNotice, Panel } from '../common/Panel'
import { formatDec, formatRA } from '../../utils/astronomy'
import { playTone } from '../../utils/audio'
export type CompareMode = 'wipe' | 'blink' | 'difference' | 'header'
interface StageProps {
  mode: CompareMode
  reference: Artifact | undefined
  science: Artifact | undefined
  difference: Artifact | undefined
  fits: Artifact | undefined
  synthetic: boolean
  speed: number
  onSpeed: (value: number) => void
  zoom: number
  onZoom: (value: number) => void
}
function ApertureStage({
  mode,
  reference,
  science,
  difference,
  fits,
  synthetic,
  speed,
  onSpeed,
  zoom,
  onZoom,
}: StageProps) {
  const [wipe, setWipe] = useState(50),
    [epoch, setEpoch] = useState(0),
    [playing, setPlaying] = useState(false)
  const [origin, setOrigin] = useState('50% 50%')
  const id = useId()
  useEffect(() => {
    if (!playing || mode !== 'blink') return
    const timer = setInterval(() => setEpoch((old) => 1 - old), speed)
    return () => clearInterval(timer)
  }, [playing, mode, speed])
  const style = { transform: `scale(${zoom})`, transformOrigin: origin }
  const image = (artifact: Artifact | undefined, alt: string) =>
    artifact ? (
      <ArchiveImage artifact={artifact} alt={alt} style={style} />
    ) : null
  return (
    <div className="aperture-stage-wrap">
      <div className="aperture-toolbar">
        <span>
          {synthetic ? 'SYNTHETIC DEMO' : 'ARCHIVE PRODUCT'} /{' '}
          {mode.toUpperCase()}
        </span>
        <div className="segmented">
          {[1, 2, 4].map((value) => (
            <button
              key={value}
              aria-pressed={zoom === value}
              onClick={() => onZoom(value)}
            >
              {value}×
            </button>
          ))}
        </div>
      </div>
      {mode === 'header' ? (
        <FitsInspector key={fits?.url} artifact={fits} />
      ) : (
        <div
          className="aperture-stage"
          onPointerMove={(event) => {
            if (zoom > 1) {
              const bounds = event.currentTarget.getBoundingClientRect()
              setOrigin(
                `${((event.clientX - bounds.left) / bounds.width) * 100}% ${((event.clientY - bounds.top) / bounds.height) * 100}%`,
              )
            }
          }}
        >
          {mode === 'difference' ? (
            difference ? (
              image(difference, 'Science minus reference difference image')
            ) : (
              <div className="awaiting-image">
                <Minus size={30} />
                <strong>NO DIFFERENCE PRODUCT</strong>
                <p>Create a difference job for this selected pair.</p>
              </div>
            )
          ) : reference && science ? (
            <>
              {mode === 'blink' ? (
                image(
                  epoch === 0 ? reference : science,
                  epoch === 0 ? 'Earlier epoch' : 'Later epoch',
                )
              ) : (
                <>
                  <div className="wipe-layer">
                    {image(reference, 'Earlier reference epoch')}
                  </div>
                  <div
                    className="wipe-layer"
                    style={{ clipPath: `inset(0 0 0 ${wipe}%)` }}
                  >
                    {image(science, 'Later science epoch')}
                  </div>
                  <div className="wipe-laser" style={{ left: `${wipe}%` }}>
                    <span>
                      <ArrowLeftRight size={14} />
                    </span>
                  </div>
                </>
              )}
              <span className="epoch-label left">
                {mode === 'blink'
                  ? epoch === 0
                    ? 'REFERENCE'
                    : 'SCIENCE'
                  : 'REFERENCE / EARLIER'}
              </span>
              {mode === 'wipe' && (
                <span className="epoch-label right">SCIENCE / LATER</span>
              )}
            </>
          ) : (
            <div className="awaiting-image">
              <ScanLine size={42} />
              <strong>ESTABLISH A TEMPORAL BASELINE</strong>
              <p>
                Load observations and build a comparison.
                <br />
                Only processed archive products appear here.
              </p>
            </div>
          )}
          <span className="image-scale">NORTH ↑ / EAST ← / {zoom}× VIEW</span>
          <div className="stage-corners" aria-hidden="true" />
        </div>
      )}
      {mode === 'wipe' && reference && science && (
        <label className="range-control" htmlFor={`${id}-wipe`}>
          <span>REFERENCE</span>
          <input
            id={`${id}-wipe`}
            type="range"
            min="0"
            max="100"
            value={wipe}
            onChange={(event) => setWipe(Number(event.target.value))}
            aria-label="Epoch split position"
          />
          <span>SCIENCE</span>
        </label>
      )}
      {mode === 'blink' && (
        <div className="blink-controls">
          <button
            className="button-quiet"
            disabled={!reference || !science}
            onClick={() => setPlaying((old) => !old)}
          >
            {playing ? <Pause size={14} /> : <Play size={14} />}{' '}
            {playing ? 'PAUSE' : 'START BLINK'}
          </button>
          <label htmlFor={`${id}-speed`}>
            INTERVAL{' '}
            <input
              id={`${id}-speed`}
              type="range"
              min="150"
              max="2000"
              step="50"
              value={speed}
              onChange={(event) => onSpeed(Number(event.target.value))}
            />
            <output>{speed} ms</output>
          </label>
        </div>
      )}
    </div>
  )
}
interface Props {
  target: EnhancedTarget
  pipeline: Pipeline
  semiMajor?: number
  onSemiMajor?: (value: number) => void
  inclination?: number
  onInclination?: (value: number) => void
  animateOrbit?: boolean
  onAnimateOrbit?: (value: boolean) => void
}
export function ApertureModal({
  target,
  pipeline: p,
  semiMajor = 600,
  onSemiMajor,
  inclination = 30,
  onInclination,
  animateOrbit = true,
  onAnimateOrbit,
}: Props) {
  const [mode, setMode] = useState<CompareMode>('wipe'),
    [speed, setSpeed] = useState(500),
    [zoom, setZoom] = useState(1)
  const [detector, setDetector] = useState('auto'),
    [referenceIndex, setReferenceIndex] = useState(0),
    [scienceIndex, setScienceIndex] = useState(-1)
  const [localError, setLocalError] = useState<string | null>(null),
    [dialogOpen, setDialogOpen] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const relevant =
    p.result?.query.source === 'spherex' &&
    p.result.query.ra === target.ra &&
    p.result.query.dec === target.dec
  const all = relevant ? (p.result?.observations ?? []) : []
  const detectors = [
    ...new Set(
      all
        .map((item) => item.detector)
        .filter((value): value is number => value != null),
    ),
  ].sort()
  const effective = detector === 'auto' ? detectors[0] : Number(detector)
  const group = all
    .filter((item) => item.detector === effective)
    .sort((a, b) => (a.mjd_start ?? 0) - (b.mjd_start ?? 0))
  const reference = group[referenceIndex],
    science = group[scienceIndex < 0 ? group.length - 1 : scienceIndex]
  const ids = [reference?.id, science?.id].filter(
    (value): value is string => !!value,
  )
  const matching = (job: Job) =>
    job.request.source === 'spherex' &&
    job.request.ra === target.ra &&
    job.request.dec === target.dec &&
    job.request.observation_ids.length === 2 &&
    ids.every((id) => job.request.observation_ids.includes(id))
  const blink = [...p.completed]
    .reverse()
    .find((job) => job.request.kind === 'blink' && matching(job))
  const diff = [...p.completed]
    .reverse()
    .find((job) => job.request.kind === 'difference' && matching(job))
  const refImage = blink?.artifacts?.find(
      (item) => item.name === 'frame-00.png',
    ),
    scienceImage = blink?.artifacts?.find(
      (item) => item.name === 'frame-01.png',
    )
  const diffImage = diff?.artifacts?.find((item) => item.name === 'result.png')
  const fits =
    blink?.artifacts?.find((item) => item.name === 'frame-00.fits') ??
    diff?.artifacts?.find((item) => item.name.endsWith('.fits'))
  const synthetic = all.some((item) => item.synthetic)
  function build(kind: 'blink' | 'difference') {
    if (!reference || !science || reference.id === science.id) {
      setLocalError('Choose two different observations.')
      return
    }
    if (
      reference.mjd_start == null ||
      science.mjd_start == null ||
      reference.mjd_start > science.mjd_start
    ) {
      setLocalError(
        'Reference must have a known MJD earlier than the science image.',
      )
      return
    }
    setLocalError(null)
    playTone('aperture')
    void p.run(kind, ids, target.fov_deg)
  }
  const stageProps = {
    mode,
    reference: refImage,
    science: scienceImage,
    difference: diffImage,
    fits,
    synthetic,
    speed,
    onSpeed: setSpeed,
    zoom,
    onZoom: setZoom,
  }
  return (
    <div className="mode-content comparator-mode">
      <div className="view-title">
        <div>
          <span className="eyebrow">02 / TEMPORAL COMPARISON</span>
          <h1>
            The aperture<span>.</span>
          </h1>
          <p>One sky. Two moments. A different perspective.</p>
        </div>
        <div className="view-tag">SOURCE / SPHEREx · ICRS</div>
      </div>
      <div className="comparator-grid">
        <aside>
          <Panel number="01" title="Target diagnostics">
            <div className="target-diagnostic">
              <div className="small-reticle" aria-hidden="true">
                +
              </div>
              <span className="eyebrow">SELECTED REFERENCE FIELD</span>
              <h3>{target.name}</h3>
              <p>{target.category}</p>
              <dl>
                <div>
                  <dt>RIGHT ASCENSION</dt>
                  <dd>{formatRA(target.ra)}</dd>
                </div>
                <div>
                  <dt>DECLINATION</dt>
                  <dd>{formatDec(target.dec)}</dd>
                </div>
                <div>
                  <dt>FIELD CENTRE</dt>
                  <dd>
                    {target.ra.toFixed(5)}° / {target.dec.toFixed(5)}°
                  </dd>
                </div>
                <div>
                  <dt>WAVELENGTH COVERAGE</dt>
                  <dd>0.75–5.00 µm / 6 detectors</dd>
                </div>
              </dl>
              <a
                className="text-link"
                href={target.coordinate_source}
                target="_blank"
                rel="noreferrer"
              >
                Coordinate source ↗
              </a>
              <p className="panel-footnote">
                Reference coordinates are not propagated to each epoch.
                Proper-motion vectors and source distances are not measured by
                this interface.
              </p>
            </div>
            <button
              className="button-primary full-width"
              disabled={p.busy}
              onClick={() => {
                setDetector('auto')
                setReferenceIndex(0)
                setScienceIndex(-1)
                setLocalError(null)
                void p.load({
                  source: 'spherex',
                  ra: target.ra,
                  dec: target.dec,
                  radius_deg: 0.001,
                  limit: 100,
                })
              }}
            >
              <SearchIcon />
              {p.busy ? 'ARCHIVE PIPELINE BUSY' : 'LOAD TARGET OBSERVATIONS'}
            </button>
          </Panel>
          <Panel number="02" title="Temporal baseline">
            <div className="epoch-selectors">
              <label htmlFor="comparison-detector">
                DETECTOR
                <select
                  id="comparison-detector"
                  value={detector}
                  onChange={(event) => {
                    setDetector(event.target.value)
                    setReferenceIndex(0)
                    setScienceIndex(-1)
                  }}
                >
                  <option value="auto">Auto / first available</option>
                  {detectors.map((value) => (
                    <option key={value} value={value}>
                      D{value}
                    </option>
                  ))}
                </select>
              </label>
              <label htmlFor="reference-epoch">
                REFERENCE / EARLIER
                <select
                  id="reference-epoch"
                  value={referenceIndex}
                  onChange={(event) =>
                    setReferenceIndex(Number(event.target.value))
                  }
                >
                  {group.map((item, index) => (
                    <option key={item.id} value={index}>
                      MJD {item.mjd_start?.toFixed(5) ?? 'unknown'}
                    </option>
                  ))}
                </select>
              </label>
              <label htmlFor="science-epoch">
                SCIENCE / LATER
                <select
                  id="science-epoch"
                  value={scienceIndex}
                  onChange={(event) =>
                    setScienceIndex(Number(event.target.value))
                  }
                >
                  <option value="-1">Latest available</option>
                  {group.map((item, index) => (
                    <option key={item.id} value={index}>
                      MJD {item.mjd_start?.toFixed(5) ?? 'unknown'}
                    </option>
                  ))}
                </select>
              </label>
              <div className="baseline">
                <small>SAMPLED TIME SEPARATION</small>
                <strong>
                  {reference?.mjd_start != null && science?.mjd_start != null
                    ? Math.abs(science.mjd_start - reference.mjd_start).toFixed(
                        2,
                      )
                    : '—'}{' '}
                  <span>DAYS</span>
                </strong>
              </div>
              <button
                className="button-primary"
                disabled={p.busy || group.length < 2}
                onClick={() => build('blink')}
              >
                <Film size={15} />
                BUILD COMPARISON
              </button>
              <button
                className="button-quiet"
                disabled={p.busy || group.length < 2}
                onClick={() => {
                  setMode('difference')
                  build('difference')
                }}
              >
                <Minus size={15} />
                CREATE SCIENCE − REFERENCE
              </button>
            </div>
          </Panel>
          <Panel number="03" title="Planet X hypothesis">
            <div className="orbit-controls">
              <label htmlFor="comparator-orbit-a">
                SEMI-MAJOR AXIS<output>{semiMajor} AU</output>
                <input
                  id="comparator-orbit-a"
                  type="range"
                  min="400"
                  max="800"
                  step="10"
                  value={semiMajor}
                  onChange={(event) =>
                    onSemiMajor?.(Number(event.target.value))
                  }
                />
              </label>
              <label htmlFor="comparator-orbit-i">
                INCLINATION<output>{inclination}°</output>
                <input
                  id="comparator-orbit-i"
                  type="range"
                  min="0"
                  max="60"
                  value={inclination}
                  onChange={(event) =>
                    onInclination?.(Number(event.target.value))
                  }
                />
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={animateOrbit}
                  onChange={(event) =>
                    onAnimateOrbit?.(event.target.checked)
                  }
                />
                ANIMATE ILLUSTRATIVE FLOW
              </label>
              <p className="panel-footnote">
                Illustrative eccentric orbit · e = 0.65.
                Not a fitted orbit or a predicted sky position. Flow is illustrative.
              </p>
            </div>
          </Panel>
        </aside>
        <div className="aperture-main">
          <ErrorNotice message={localError ?? p.error} />
          <div
            className="compare-mode-tabs"
            role="group"
            aria-label="Comparison mode"
          >
            {(
              [
                { id: 'wipe', label: 'Split wipe', icon: ArrowLeftRight },
                { id: 'blink', label: 'Blink', icon: Film },
                { id: 'difference', label: 'Difference', icon: Minus },
                { id: 'header', label: 'FITS / WCS', icon: Code2 },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                className={mode === item.id ? 'active' : ''}
                aria-pressed={mode === item.id}
                onClick={() => {
                  setMode(item.id)
                  playTone('hover')
                }}
              >
                <item.icon size={15} />
                {item.label}
              </button>
            ))}
            <button
              className="icon-button"
              onClick={() => {
                playTone('aperture')
                setDialogOpen(true)
                dialog.current?.showModal()
              }}
              aria-label="Open full-screen aperture"
            >
              <Maximize2 size={16} />
            </button>
          </div>
          <ApertureStage {...stageProps} />
          <div className="aperture-caption">
            <span>
              {p.job?.status === 'running' || p.job?.status === 'queued'
                ? `PIPELINE ${p.job.status.toUpperCase()} · ${p.job.id.slice(0, 8)}`
                : 'SYNCHRONIZED WCS GRID'}
            </span>
            <span>
              {target.fov_deg.toFixed(2)}° FIELD · ZOOM IS VISUAL, NOT
              ASTROMETRY
            </span>
          </div>
          {p.job && !p.busy && ['queued', 'running'].includes(p.job.status) && (
            <button className="button-quiet" onClick={p.resume}>
              RESUME JOB STATUS CHECK
            </button>
          )}
          <Downloads
            jobs={[blink, diff].filter((item): item is Job => !!item)}
          />
          <div className="science-notice">
            A difference is exploratory, without PSF or wavelength matching.
            Residuals and brightness changes are not a confirmed moving-object
            detection.
          </div>
          {p.result?.possibly_truncated && (
            <p className="panel-footnote">
              Limited archive sample; these are not guaranteed to be the
              earliest/latest mission visits.
            </p>
          )}
          {[...(blink?.warnings ?? []), ...(diff?.warnings ?? [])]
            .filter((value, index, array) => array.indexOf(value) === index)
            .map((warning) => (
              <p key={warning} className="quality-warning">
                {warning}
              </p>
            ))}
        </div>
      </div>
      <dialog
        ref={dialog}
        className="aperture-dialog"
        onClose={() => setDialogOpen(false)}
      >
        <div className="dialog-heading">
          <strong>{target.name} / APERTURE</strong>
          <button
            className="icon-button"
            onClick={() => dialog.current?.close()}
            aria-label="Close aperture"
          >
            <X size={20} />
          </button>
        </div>
        {dialogOpen && <ApertureStage {...stageProps} />}
      </dialog>
    </div>
  )
}
function SearchIcon() {
  return <ScanLine size={15} />
}
