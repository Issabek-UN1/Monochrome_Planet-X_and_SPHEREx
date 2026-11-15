import { useMemo, useState, type CSSProperties } from 'react'
import { Download, FlaskConical, Info, ScanLine } from 'lucide-react'
import { type EnhancedTarget } from '../../api/client'
import { DETECTORS, planck } from '../../utils/astronomy'
import { playTone } from '../../utils/audio'
import { MeasuredSpectrum } from './MeasuredSpectrum'
const MOLECULES = [
  {
    id: 'methane',
    label: 'CH₄',
    name: 'Methane',
    color: '#10B981',
    centres: [1.66, 3.3],
  },
  {
    id: 'water',
    label: 'H₂O',
    name: 'Water',
    color: '#06B6D4',
    centres: [1.9, 2.7],
  },
  {
    id: 'carbon-dioxide',
    label: 'CO₂',
    name: 'Carbon dioxide',
    color: '#F43F5E',
    centres: [4.26],
  },
  {
    id: 'carbon-monoxide',
    label: 'CO',
    name: 'Carbon monoxide',
    color: '#A855F7',
    centres: [4.67],
  },
]
const ModelReference = ({
  initialTarget,
}: {
  initialTarget?: EnhancedTarget | null
}) => {
  const [wavelength, setWavelength] = useState(3.3),
    [temperature, setTemperature] = useState(250)
  const [visible, setVisible] = useState(MOLECULES.map((item) => item.id)),
    [compare, setCompare] = useState(true)
  const bin = Math.round(((wavelength - 0.75) / 4.25) * 101) + 1
  const detector = DETECTORS.find(
    (item) => wavelength >= item.lo && wavelength <= item.hi,
  )
  const samples = useMemo(() => {
    const values = Array.from({ length: 102 }, (_, index) => {
      const x = 0.75 + (index / 101) * 4.25
      return {
        wavelength: x,
        cold: planck(x, temperature),
        solar: planck(x, 5772),
      }
    })
    const maxCold = Math.max(...values.map((item) => item.cold)),
      maxSolar = Math.max(...values.map((item) => item.solar))
    return values.map((item) => ({
      ...item,
      cold: item.cold / maxCold,
      solar: item.solar / maxSolar,
    }))
  }, [temperature])
  const x = (value: number) => 58 + ((value - 0.75) / 4.25) * 660,
    y = (value: number) => 264 - value * 215
  const curve = (key: 'cold' | 'solar') =>
    samples
      .map(
        (item, index) =>
          `${index ? 'L' : 'M'} ${x(item.wavelength).toFixed(2)} ${y(item[key]).toFixed(2)}`,
      )
      .join(' ')
  const peak = 2897.771955 / temperature
  function changeWavelength(value: number) {
    setWavelength(value)
    playTone('scrub')
  }
  function download() {
    const csv = [
      'wavelength_um,normalized_cold_model,normalized_reflected_solar_model',
      ...samples.map((item) => `${item.wavelength},${item.cold},${item.solar}`),
    ].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
      anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `illustrative-continuum-${temperature}K.csv`
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return (
    <div className="mode-content spectral-mode">
      <div className="view-title">
        <div>
          <span className="eyebrow">03 / SPECTRAL REFERENCE WORKSPACE</span>
          <h1>
            Beyond visible<span>.</span>
          </h1>
          <p>
            Explore infrared coverage and the physics behind a cold-world
            search.
          </p>
        </div>
        <span className="view-tag">
          <FlaskConical size={16} />
          ILLUSTRATIVE MODELS
        </span>
      </div>
      <div className="science-notice">
        <Info size={17} />
        <span>
          This reference section shows normalized Planck models. Load real
          DR1 measurements in the panel above. Model curves are not observations
          or atmospheric classifications; marker windows are approximate.
        </span>
      </div>
      <div className="spectral-grid">
        <section className="hud-panel spectral-chart-panel">
          <div className="panel-heading">
            <h2>
              <span>01</span>Spectral energy distribution
            </h2>
            <small>MODEL / RELATIVE Fλ</small>
          </div>
          <div className="spectral-chart-head">
            <div>
              <small>SELECTED WAVELENGTH</small>
              <strong>
                {wavelength.toFixed(3)} <span>µm</span>
              </strong>
            </div>
            <div>
              <small>REFERENCE FIELD</small>
              <span>{initialTarget?.name ?? 'Custom field'}</span>
            </div>
          </div>
          <svg
            className="spectral-chart"
            viewBox="0 0 760 310"
            role="img"
            aria-label="Illustrative normalized cold-body and reflected-solar continuum models, not measured spectra"
          >
            <defs>
              <linearGradient id="spectral-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity=".15" />
                <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0, 0.25, 0.5, 0.75, 1].map((value) => (
              <g key={value}>
                <line
                  x1="58"
                  x2="718"
                  y1={y(value)}
                  y2={y(value)}
                  className="chart-grid"
                />
                <text x="42" y={y(value) + 4} textAnchor="end">
                  {value.toFixed(2)}
                </text>
              </g>
            ))}
            {[0.75, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((value) => (
              <g key={value}>
                <line
                  x1={x(value)}
                  x2={x(value)}
                  y1="35"
                  y2="264"
                  className="chart-grid"
                />
                <text x={x(value)} y="290" textAnchor="middle">
                  {value}
                </text>
              </g>
            ))}
            {MOLECULES.filter((item) => visible.includes(item.id)).flatMap(
              (item) =>
                item.centres.map((centre) => (
                  <g key={`${item.id}-${centre}`}>
                    <rect
                      x={x(centre) - 8}
                      y="38"
                      width="16"
                      height="226"
                      fill={item.color}
                      opacity=".09"
                    />
                    <line
                      x1={x(centre)}
                      x2={x(centre)}
                      y1="38"
                      y2="264"
                      stroke={item.color}
                      strokeDasharray="3 5"
                      opacity=".5"
                    />
                    <text
                      x={x(centre)}
                      y={centre < 2 ? '26' : '18'}
                      fill={item.color}
                      textAnchor="middle"
                    >
                      {item.label}
                    </text>
                  </g>
                )),
            )}
            <path
              d={`${curve('cold')} L718 264 L58 264Z`}
              fill="url(#spectral-area)"
            />
            <path
              d={curve('cold')}
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="2"
            />
            {compare && (
              <path
                d={curve('solar')}
                fill="none"
                stroke="rgba(255, 255, 255, 0.65)"
                strokeWidth="1.8"
                strokeDasharray="6 4"
              />
            )}
            <line
              x1={x(wavelength)}
              x2={x(wavelength)}
              y1="32"
              y2="264"
              stroke="#FFFFFF"
              strokeWidth="1.2"
            />
            <circle cx={x(wavelength)} cy="264" r="4" fill="#FFFFFF" />
          </svg>
          <div className="chart-legend">
            <span>
              <i className="solid-line" />
              Cold-body continuum / {temperature} K
            </span>
            <span>
              <i className="dashed-line" />
              Reflected-solar shape / 5772 K reference
            </span>
          </div>
          <div className="spectral-scrubber">
            <label htmlFor="wavelength">
              <span>WAVELENGTH SCRUBBER</span>
              <output>
                REFERENCE BIN {String(bin).padStart(3, '0')} / 102
              </output>
            </label>
            <input
              id="wavelength"
              aria-label="Reference wavelength"
              type="range"
              min="0.75"
              max="5"
              step="0.001"
              value={wavelength}
              onChange={(event) => changeWavelength(Number(event.target.value))}
            />
            <div className="bin-ruler" aria-hidden="true">
              {samples.map((item, index) => (
                <i
                  key={index}
                  className={index + 1 === bin ? 'active' : ''}
                  style={{ height: index % 17 === 0 ? '19px' : '8px' }}
                  title={item.wavelength.toFixed(3)}
                />
              ))}
            </div>
            <div className="range-labels">
              <span>0.750 µm / NEAR IR</span>
              <span>5.000 µm</span>
            </div>
          </div>
          <p className="panel-footnote">
            The 102-bin ruler is a visualization axis, not the calibrated
            instrument channel table. Detector bounds below are physical
            coverage; the small gaps are retained.
          </p>
        </section>
        <aside className="spectral-controls">
          <section className="hud-panel">
            <div className="panel-heading">
              <h2>
                <span>02</span>Molecular references
              </h2>
            </div>
            <div className="molecule-list">
              {MOLECULES.map((item) => (
                <button
                  key={item.id}
                  aria-label={`Toggle ${item.name} reference regions`}
                  aria-pressed={visible.includes(item.id)}
                  className={visible.includes(item.id) ? 'selected' : ''}
                  style={{ '--molecule-color': item.color } as CSSProperties}
                  onClick={() => {
                    playTone('hover')
                    setVisible((old) =>
                      old.includes(item.id)
                        ? old.filter((value) => value !== item.id)
                        : [...old, item.id],
                    )
                  }}
                >
                  <strong>{item.label}</strong>
                  <span>
                    {item.name}
                    <small>{item.centres.join(' / ')} µm</small>
                  </span>
                  <i />
                </button>
              ))}
            </div>
            <p className="panel-footnote">
              Overlays mark reference absorption regions. They do not indicate a
              molecule detected in this field.
            </p>
          </section>
          <section className="hud-panel">
            <div className="panel-heading">
              <h2>
                <span>03</span>Continuum model
              </h2>
            </div>
            <div className="model-controls">
              <label htmlFor="model-temperature">
                MODEL TEMPERATURE<output>{temperature} K</output>
                <input
                  id="model-temperature"
                  type="range"
                  min="100"
                  max="2500"
                  step="10"
                  value={temperature}
                  onChange={(event) =>
                    setTemperature(Number(event.target.value))
                  }
                />
              </label>
              <div className="model-readout">
                <small>WIEN PEAK / Fλ</small>
                <strong>{peak.toFixed(2)} µm</strong>
                <span>
                  {peak > 5
                    ? 'Beyond this plotted wavelength range'
                    : 'Within the plotted range'}
                </span>
              </div>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={compare}
                  onChange={(event) => setCompare(event.target.checked)}
                />
                Compare reflected-solar shape
              </label>
              <button className="button-quiet full-width" onClick={download}>
                <Download size={14} />
                EXPORT MODEL CSV
              </button>
            </div>
          </section>
          <div className="classification-note">
            <ScanLine size={19} />
            <span>
              NO CLASSIFICATION INFERRED
              <small>
                Calibrated source extraction is a future capability.
              </small>
            </span>
          </div>
        </aside>
      </div>
      <section
        className="detector-strip"
        aria-label="Detector wavelength coverage"
      >
        {DETECTORS.map((item) => (
          <button
            key={item.id}
            aria-pressed={detector?.id === item.id}
            className={detector?.id === item.id ? 'active' : ''}
            onClick={() => changeWavelength((item.lo + item.hi) / 2)}
          >
            <span>DETECTOR 0{item.id}</span>
            <strong>
              {item.lo.toFixed(2)}—{item.hi.toFixed(2)}
            </strong>
            <small>
              µm / {detector?.id === item.id ? 'SELECTED' : 'COVERAGE'}
            </small>
            <div className="detector-mini-bars" aria-hidden="true">
              {Array.from({ length: 17 }, (_, index) => (
                <i
                  key={index}
                  style={{
                    height: `${10 + ((index * 7 + item.id * 3) % 19)}px`,
                  }}
                />
              ))}
            </div>
          </button>
        ))}
      </section>
    </div>
  )
}

export const SpectralLab = ({
  initialTarget,
}: {
  initialTarget?: EnhancedTarget | null
}) => (
  <>
    <MeasuredSpectrum
      key={`${initialTarget?.ra}:${initialTarget?.dec}`}
      target={initialTarget}
    />
    <details className="quality-notes">
      <summary>ILLUSTRATIVE MODELS / REFERENCE ONLY</summary>
      <ModelReference initialTarget={initialTarget} />
    </details>
  </>
)
