import { useEffect, useState } from 'react'
import {
  Check,
  ChevronDown,
  Film,
  Layers,
  Minus,
  Radio,
  Satellite,
  Search,
  Terminal,
} from 'lucide-react'
import { CURATED_TARGETS, type EnhancedTarget } from '../../api/client'
import type {
  JobRequest,
  Observation,
  SkySearch,
} from '@monochrome-spherex/api-client'
import { usePipeline, type Pipeline } from '../../hooks/usePipeline'
import { Panel, ErrorNotice } from '../common/Panel'
import { ArtifactViewer } from '../common/ArtifactViewer'
import { playTone } from '../../utils/audio'
interface Props {
  initialTarget?: EnhancedTarget | null
  pipeline?: Pipeline
  onTarget?: (target: EnhancedTarget) => void
  source?: SkySearch['source']
  onSource?: (source: SkySearch['source']) => void
  initialDetector?: number | null
  initialSearch?: SkySearch | null
  onPointing?: (query: SkySearch, fov: number, preset?: EnhancedTarget) => void
}
export const SkyExplorer = ({
  initialTarget,
  pipeline,
  onTarget,
  source: controlledSource,
  onSource,
  initialDetector,
  initialSearch,
  onPointing,
}: Props) => {
  const [localSource, setSource] = useState<'spherex' | 'neossat'>(
    pipeline?.result?.query.source ?? 'spherex',
  )
  const source = controlledSource ?? localSource
  return (
    <ExplorerSession
      key={`${source}:${initialTarget?.id}:${initialTarget?.ra}:${initialTarget?.dec}`}
      initialTarget={initialTarget}
      source={source}
      onSource={(value) => {
        if (value === source) return
        pipeline?.reset()
        setSource(value)
        onSource?.(value)
      }}
      pipeline={pipeline}
      onTarget={onTarget}
      initialDetector={initialDetector}
      initialSearch={initialSearch}
      onPointing={onPointing}
    />
  )
}
interface SessionProps extends Props {
  source: 'spherex' | 'neossat'
  onSource: (source: 'spherex' | 'neossat') => void
}
function ExplorerSession({
  initialTarget,
  source,
  onSource,
  pipeline,
  onTarget,
  initialDetector,
  initialSearch,
  onPointing,
}: SessionProps) {
  const local = usePipeline(),
    p = pipeline ?? local
  const previousQuery =
    p.result?.query ??
    (initialSearch?.source === source &&
    initialSearch.ra === initialTarget?.ra &&
    initialSearch.dec === initialTarget?.dec
      ? initialSearch
      : null)
  const [ra, setRa] = useState(
      p.result?.query.ra ?? initialTarget?.ra ?? 133.7951,
    ),
    [dec, setDec] = useState(
      p.result?.query.dec ?? initialTarget?.dec ?? -7.2451,
    )
  const [radius, setRadius] = useState(
      p.result?.query.radius_deg ?? initialTarget?.radius_deg ?? 0.05,
    ),
    [fov, setFov] = useState(initialTarget?.fov_deg ?? 0.1)
  const [size, setSize] = useState(256),
    [detector, setDetector] = useState('all')
  const [queryDetector, setQueryDetector] = useState(
    String(p.result?.query.detector ?? initialDetector ?? 'all'),
  )
  const [mjdMin, setMjdMin] = useState(String(previousQuery?.mjd_min ?? '')),
    [mjdMax, setMjdMax] = useState(String(previousQuery?.mjd_max ?? ''))
  const [selection, setSelection] = useState<string[] | null>(null),
    [validation, setValidation] = useState<string | null>(null)
  const [showLog, setShowLog] = useState(true)
  const [slowJob, setSlowJob] = useState<string | null>(null)
  const queuedId = p.job?.status === 'queued' ? p.job.id : null
  const queuedAt = p.job?.created_at
  useEffect(() => {
    if (!queuedId || queuedAt == null) return
    const timer = setTimeout(
      () => setSlowJob(queuedId),
      Math.max(0, 30000 - (Date.now() - queuedAt * 1000)),
    )
    return () => clearTimeout(timer)
  }, [queuedId, queuedAt])
  const observations = (p.result?.observations ?? []).filter(
    (item) => detector === 'all' || String(item.detector) === detector,
  )
  const group = observations.filter(
    (item) => item.detector === observations[0]?.detector,
  )
  const defaultIds =
    group.length > 1
      ? [group[0].id, group[group.length - 1].id]
      : group.slice(0, 1).map((item) => item.id)
  const ids = selection ?? defaultIds
  const chosen = (p.result?.observations ?? []).filter((item) =>
    ids.includes(item.id),
  )
  const sameDetector =
    chosen.length > 0 &&
    chosen[0].detector != null &&
    chosen.every((item) => item.detector === chosen[0].detector)
  function load(
    searchRa = ra,
    searchDec = dec,
    searchRadius = radius,
    preset?: EnhancedTarget,
  ) {
    if (
      ![searchRa, searchDec, searchRadius].every(Number.isFinite) ||
      searchRa < 0 ||
      searchRa >= 360 ||
      Math.abs(searchDec) > 90 ||
      searchRadius <= 0 ||
      searchRadius > 2
    ) {
      setValidation('RA must be 0–<360°, Dec −90–90°, and search radius >0–2°.')
      return
    }
    setValidation(null)
    const query: SkySearch = {
      source,
      ra: searchRa,
      dec: searchDec,
      radius_deg: searchRadius,
      limit: 100,
      ...(source === 'spherex' && queryDetector !== 'all'
        ? { detector: Number(queryDetector) }
        : {}),
      ...(mjdMin.trim() ? { mjd_min: Number(mjdMin) } : {}),
      ...(mjdMax.trim() ? { mjd_max: Number(mjdMax) } : {}),
    }
    if (
      [query.mjd_min, query.mjd_max].some(
        (value) => value != null && (!Number.isFinite(value) || value < 0),
      ) ||
      (query.mjd_min != null &&
        query.mjd_max != null &&
        query.mjd_min > query.mjd_max)
    ) {
      setValidation(
        'MJD limits must be non-negative, with the start before the end.',
      )
      return
    }
    setSelection(null)
    setDetector('all')
    playTone('select')
    if (preset && !onPointing) onTarget?.(preset)
    onPointing?.(
      query,
      preset?.fov_deg ??
        (Number.isFinite(fov) && fov >= 0.005 && fov <= 0.5
          ? fov
          : (initialTarget?.fov_deg ?? 0.1)),
      preset,
    )
    void p.load(query)
  }
  function launch(kind: JobRequest['kind']) {
    if (!Number.isFinite(fov) || fov < 0.005 || fov > 0.5) {
      setValidation('Image field must be between 0.005° and 0.5°.')
      return
    }
    let ordered = ids
    if (kind === 'difference') {
      if (chosen.some((item) => item.mjd_start == null)) {
        setValidation(
          'Difference needs known observation dates to order reference and science.',
        )
        return
      }
      ordered = [...chosen]
        .sort((a, b) => (a.mjd_start ?? 0) - (b.mjd_start ?? 0))
        .map((item) => item.id)
    }
    setValidation(null)
    playTone('select')
    void p.run(kind, ordered, fov, size)
  }
  const actions = [
    {
      kind: 'blink',
      label: 'GENERATE BLINK',
      note: '2–12 frames',
      icon: Film,
      allowed: ids.length >= 2,
    },
    {
      kind: 'difference',
      label: 'DIFFERENCE',
      note: 'Later − earlier epoch',
      icon: Minus,
      allowed: source === 'spherex' && ids.length === 2 && sameDetector,
    },
    {
      kind: 'stack',
      label: 'CO-ADD STACK',
      note: 'Inverse-variance mean',
      icon: Layers,
      allowed: source === 'spherex' && ids.length >= 2 && sameDetector,
    },
    {
      kind: 'cutout',
      label: 'SINGLE CUTOUT',
      note: '1 observation',
      icon: Search,
      allowed: ids.length === 1,
    },
  ] as const
  const warnings = [...(p.result?.warnings ?? []), ...(p.job?.warnings ?? [])]
  return (
    <div className="mode-content explorer-mode">
      <div className="view-title">
        <div>
          <span className="eyebrow">04 / LIVE ARCHIVE OPERATIONS</span>
          <h1>
            Signal acquisition<span>.</span>
          </h1>
          <p>Point at the sky. Select an epoch. Follow what changes.</p>
        </div>
        <div className="source-switch" aria-label="Data source">
          <button
            aria-pressed={source === 'spherex'}
            className={source === 'spherex' ? 'selected' : ''}
            onClick={() => onSource('spherex')}
          >
            <Radio size={16} />
            SPHEREx IR
          </button>
          <button
            aria-pressed={source === 'neossat'}
            className={source === 'neossat' ? 'selected' : ''}
            onClick={() => onSource('neossat')}
          >
            <Satellite size={16} />
            NEOSSat CADC
          </button>
        </div>
      </div>
      <div className="preset-row">
        <span>QUICK POINTING</span>
        {CURATED_TARGETS.map((target) => (
          <button
            key={target.id}
            onClick={() => {
              setRa(target.ra)
              setDec(target.dec)
              setRadius(target.radius_deg)
              setFov(target.fov_deg)
              load(target.ra, target.dec, target.radius_deg, target)
            }}
          >
            {target.name}
          </button>
        ))}
      </div>
      <ErrorNotice message={validation ?? p.error} />
      {p.result?.observations.some((item) => item.synthetic) && (
        <div className="science-notice">
          SYNTHETIC DEMO DATA · Generated by the backend. Not telescope
          observations.
        </div>
      )}
      {p.result?.possibly_truncated && (
        <div className="science-notice">
          LIMITED SAMPLE · More observations may exist. Narrow the radius or
          time range before interpreting epoch coverage.
        </div>
      )}
      <div className="explorer-grid">
        <div className="explorer-controls">
          <Panel number="01" title="Pointing solution" meta="ICRS / DEGREES">
            <form
              onSubmit={(event) => {
                event.preventDefault()
                load()
              }}
              className="pointing-form"
            >
              <label htmlFor="point-ra">
                Right ascension <span>α / 0–360°</span>
                <input
                  id="point-ra"
                  type="number"
                  step="any"
                  min="0"
                  max="359.999999"
                  required
                  value={Number.isNaN(ra) ? '' : ra}
                  onChange={(event) => setRa(event.target.valueAsNumber)}
                />
              </label>
              <label htmlFor="point-dec">
                Declination <span>δ / ±90°</span>
                <input
                  id="point-dec"
                  type="number"
                  step="any"
                  min="-90"
                  max="90"
                  required
                  value={Number.isNaN(dec) ? '' : dec}
                  onChange={(event) => setDec(event.target.valueAsNumber)}
                />
              </label>
              <label htmlFor="point-radius">
                Search radius <span>DEG</span>
                <input
                  id="point-radius"
                  type="number"
                  step="any"
                  min=".0001"
                  max="2"
                  required
                  value={Number.isNaN(radius) ? '' : radius}
                  onChange={(event) => setRadius(event.target.valueAsNumber)}
                />
              </label>
              <label htmlFor="point-fov">
                Image field <span>DEG</span>
                <input
                  id="point-fov"
                  type="number"
                  step=".005"
                  min=".005"
                  max=".5"
                  value={Number.isNaN(fov) ? '' : fov}
                  onChange={(event) => setFov(event.target.valueAsNumber)}
                />
              </label>
              <label htmlFor="point-size">
                Output grid <span>PIXELS</span>
                <select
                  id="point-size"
                  value={size}
                  onChange={(event) => setSize(Number(event.target.value))}
                >
                  {[128, 256, 512].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label htmlFor="query-detector">
                Archive detector
                <select
                  id="query-detector"
                  value={queryDetector}
                  disabled={source === 'neossat'}
                  onChange={(event) => setQueryDetector(event.target.value)}
                >
                  <option value="all">All detectors</option>
                  {[1, 2, 3, 4, 5, 6].map((value) => (
                    <option key={value} value={value}>
                      D{value}
                    </option>
                  ))}
                </select>
              </label>
              <label htmlFor="mjd-min">
                Start MJD (optional)
                <input
                  id="mjd-min"
                  type="number"
                  min="0"
                  step="any"
                  value={mjdMin}
                  onChange={(event) => setMjdMin(event.target.value)}
                />
              </label>
              <label htmlFor="mjd-max">
                End MJD (optional)
                <input
                  id="mjd-max"
                  type="number"
                  min="0"
                  step="any"
                  value={mjdMax}
                  onChange={(event) => setMjdMax(event.target.value)}
                />
              </label>
              <button
                className="button-primary span-two"
                type="submit"
                disabled={p.busy}
              >
                <Search size={15} />
                {p.busy && !p.job
                  ? 'SEARCHING ARCHIVE…'
                  : `QUERY ${source.toUpperCase()} OBSERVATIONS`}
              </button>
            </form>
            {fov > 0.25 && (
              <p className="panel-footnote">
                Large fields need larger archive cutouts and can take longer to
                process.
              </p>
            )}
          </Panel>
          <Panel
            number="02"
            title="Observation timeline"
            meta={`${observations.length} FRAMES`}
          >
            <div className="table-controls">
              <label htmlFor="detector-filter">
                Display detector
                <select
                  id="detector-filter"
                  value={detector}
                  onChange={(event) => {
                    setDetector(event.target.value)
                    setSelection(null)
                  }}
                  disabled={source === 'neossat'}
                >
                  <option value="all">All detectors</option>
                  {[1, 2, 3, 4, 5, 6].map((value) => (
                    <option key={value} value={value}>
                      D{value}
                    </option>
                  ))}
                </select>
              </label>
              <span>{ids.length}/12 SELECTED</span>
            </div>
            <div className="observation-scroll">
              {observations.length ? (
                <table className="observation-table">
                  <thead>
                    <tr>
                      <th scope="col">SELECT / OBSERVATION</th>
                      <th scope="col">MJD / BAND</th>
                    </tr>
                  </thead>
                  <tbody>
                    {observations.map((observation: Observation) => (
                      <tr
                        key={observation.id}
                        className={
                          ids.includes(observation.id) ? 'selected' : ''
                        }
                      >
                        <td>
                          <label>
                            <input
                              type="checkbox"
                              checked={ids.includes(observation.id)}
                              disabled={
                                !ids.includes(observation.id) &&
                                ids.length >= 12
                              }
                              aria-label={`Select observation ${observation.obs_id}`}
                              onChange={() =>
                                setSelection(
                                  ids.includes(observation.id)
                                    ? ids.filter((id) => id !== observation.id)
                                    : [...ids, observation.id].slice(0, 12),
                                )
                              }
                            />
                            <span>
                              <strong>
                                {observation.detector
                                  ? `DETECTOR ${observation.detector}`
                                  : observation.collection}
                              </strong>
                              <small title={observation.id}>
                                ID: {observation.id.slice(0, 16)}...
                              </small>
                            </span>
                          </label>
                        </td>
                        <td>
                          {observation.mjd_start?.toFixed(5) ?? '—'}
                          <small>
                            {observation.wavelength_min_um?.toFixed(2) ?? '—'}–
                            {observation.wavelength_max_um?.toFixed(2) ?? '—'}{' '}
                            µm
                          </small>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="empty-state">
                  <Search size={25} />
                  <p>
                    {p.result
                      ? 'No observations cover this selection. Try another field.'
                      : 'Enter coordinates to establish an archive connection.'}
                  </p>
                </div>
              )}
            </div>
          </Panel>
        </div>
        <div className="explorer-results">
          <Panel
            number="03"
            title="Processing deck"
            meta={
              source === 'neossat' ? 'OPTICAL / COUNTS' : 'INFRARED / MJy sr⁻¹'
            }
          >
            <div className="operation-grid">
              {actions.map((action) => (
                <button
                  key={action.kind}
                  disabled={!action.allowed || p.busy}
                  onClick={() => launch(action.kind)}
                >
                  <action.icon size={20} />
                  <strong>{action.label}</strong>
                  <small>{action.note}</small>
                </button>
              ))}
            </div>
            {source === 'neossat' && (
              <p className="panel-footnote">
                NEOSSat: cutout / blink only. No fabricated variance or infrared
                calibration.
              </p>
            )}
            <div
              className={`job-status status-${p.job?.status ?? 'idle'}`}
              role="status"
            >
              <span className="status-dot" />
              <strong>
                {p.job?.status.toUpperCase() ?? 'READY FOR DISPATCH'}
              </strong>
              <span>{p.job?.id.slice(0, 12) ?? 'PIPELINE / STANDBY'}</span>
              {p.job &&
                !p.busy &&
                ['queued', 'running'].includes(p.job.status) && (
                  <button onClick={p.resume}>Resume polling</button>
                )}
            </div>
            {queuedId && slowJob === queuedId && (
              <p className="panel-footnote">
                Waiting for processing. Check that the worker is running with
                the same data directory and provider as the API.
              </p>
            )}
          </Panel>
          <Panel
            number="04"
            title="Scientific viewport"
            meta="LINEAR FITS / STRETCHED PNG"
          >
            <ArtifactViewer key={p.job?.id ?? 'empty'} job={p.job} />
          </Panel>
          <section className="terminal-panel">
            <button
              className="terminal-heading"
              aria-expanded={showLog}
              onClick={() => setShowLog((old) => !old)}
            >
              <span>
                <Terminal size={15} />
                PIPELINE EVENT LOG
              </span>
              <ChevronDown size={15} />
            </button>
            {showLog && (
              <div
                className="terminal-lines"
                role="log"
                aria-label="Pipeline event log"
              >
                {p.events.length ? (
                  p.events.map((event, index) => (
                    <div key={index}>
                      <time>{event.time}</time>
                      <span>{event.text}</span>
                      <Check size={11} />
                    </div>
                  ))
                ) : (
                  <p>Connection ready. Awaiting your first request.</p>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
      {warnings.length > 0 && (
        <details className="quality-notes">
          <summary>DATA QUALITY & PROCESSING NOTES / {warnings.length}</summary>
          {[...new Set(warnings)].map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </details>
      )}
    </div>
  )
}
