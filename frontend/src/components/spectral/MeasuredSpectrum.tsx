import { useEffect, useState } from 'react'
import type { Job, SpectrumResult } from '@monochrome-spherex/api-client'
import { type EnhancedTarget, spherexApi } from '../../api/client'
import { ErrorNotice, Panel } from '../common/Panel'
import { Downloads } from '../common/ArtifactViewer'

export function MeasuredSpectrum({
  target,
}: {
  target?: EnhancedTarget | null
}) {
  const [ra, setRa] = useState(target?.ra ?? 133.79512916666667)
  const [dec, setDec] = useState(target?.dec ?? -7.245147222222222)
  const [request, setRequest] = useState<{ ra: number; dec: number } | null>(
    null,
  )
  const [job, setJob] = useState<Job | null>(null)
  const [data, setData] = useState<SpectrumResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!request) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    async function run() {
      try {
        const created = await spherexApi.createJob(
          {
            source: 'spherex',
            kind: 'spectrum',
            observation_ids: [],
            ra: request!.ra,
            dec: request!.dec,
            fov_deg: 0.1,
            size_px: 256,
            reject_flags: 4292870143,
            subtract_zodi: false,
          },
          controller.signal,
        )
        if (controller.signal.aborted) return
        setJob(created)
        for (let attempt = 0; attempt < 1200; attempt++) {
          const current = await spherexApi.getJob(created.id, controller.signal)
          if (controller.signal.aborted) return
          setJob(current)
          if (current.status === 'failed')
            throw new Error(current.error ?? 'Spectrum extraction failed')
          if (current.status === 'succeeded') {
            const spectrum = await spherexApi.getSpectrum(
              current.id,
              controller.signal,
            )
            if (!controller.signal.aborted) {
              setData(spectrum)
              setBusy(false)
            }
            return
          }
          await new Promise<void>((resolve) => {
            timer = setTimeout(resolve, 2000)
          })
          if (controller.signal.aborted) return
        }
        throw new Error(
          `Processing is taking longer than expected. Saved job: ${created.id}`,
        )
      } catch (failure) {
        if (!controller.signal.aborted) {
          setError(
            failure instanceof Error
              ? failure.message
              : 'Spectrum request failed',
          )
          setBusy(false)
        }
      }
    }
    void run()
    return () => {
      controller.abort()
      if (timer) clearTimeout(timer)
    }
  }, [request])

  const points =
    data?.samples.filter(
      (sample) => sample.usable && sample.surface_brightness_mjy_sr != null,
    ) ?? []
  const values = points.map((point) => point.surface_brightness_mjy_sr!)
  const low = Math.min(0, ...values),
    high = Math.max(low + 1e-6, ...values)
  const x = (wave: number) => 70 + ((wave - 0.7) / 4.5) * 640
  const y = (value: number) => 245 - ((value - low) / (high - low)) * 195

  return (
    <div className="mode-content spectral-mode">
      <div className="view-title">
        <div>
          <span className="eyebrow">03 / MEASURED DR1 MOSAIC SPECTRUM</span>
          <h1>
            Read the infrared<span>.</span>
          </h1>
          <p>
            102 archive channels at your sky position. Absolute surface
            brightness, with quality flags.
          </p>
        </div>
        <span className="view-tag">OBSERVATIONAL DATA / IRSA DR1</span>
      </div>
      <Panel
        number="01"
        title="Extract an observed spectrum"
        meta="ICRS / DR1 ALL-SKY CUBE"
      >
        <form
          className="pointing-form"
          onSubmit={(event) => {
            event.preventDefault()
            if (
              ![ra, dec].every(Number.isFinite) ||
              ra < 0 ||
              ra >= 360 ||
              Math.abs(dec) > 90
            ) {
              setError('Enter valid ICRS coordinates: RA 0–<360°, Dec −90–90°.')
              return
            }
            setError(null)
            setData(null)
            setJob(null)
            setBusy(true)
            setRequest({ ra, dec })
          }}
        >
          <label htmlFor="spectrum-ra">
            Spectrum RA (degrees)
            <input
              id="spectrum-ra"
              type="number"
              min="0"
              max="359.999999"
              step="any"
              required
              value={Number.isNaN(ra) ? '' : ra}
              onChange={(event) => setRa(event.target.valueAsNumber)}
            />
          </label>
          <label htmlFor="spectrum-dec">
            Spectrum Dec (degrees)
            <input
              id="spectrum-dec"
              type="number"
              min="-90"
              max="90"
              step="any"
              required
              value={Number.isNaN(dec) ? '' : dec}
              onChange={(event) => setDec(event.target.valueAsNumber)}
            />
          </label>
          <button
            className="button-primary span-two"
            disabled={busy}
            type="submit"
          >
            {busy
              ? 'EXTRACTING ARCHIVE SPECTRUM…'
              : 'LOAD MEASURED DR1 SPECTRUM'}
          </button>
        </form>
        <p className="panel-footnote">
        Reads the requested pixel in all 102 FITS layers through bounded byte-range requests.
        Allow up to a few minutes. No synthetic fallback. Available with the IRSA provider.
        </p>
        <ErrorNotice message={error} />
        <p role="status">
          {busy
            ? `PIPELINE ${job?.status.toUpperCase() ?? 'SUBMITTING'} · ${job?.id.slice(0, 12) ?? ''}`
            : data
              ? `${points.length} usable / ${data.samples.length} nominal channels`
              : 'Ready to extract real archive measurements.'}
        </p>
      </Panel>
      {data && (
        <Panel
          number="02"
          title="Measured spectral profile"
          meta="ABSOLUTE MJy/sr / NO NORMALIZATION"
        >
          <div className="science-notice">
            Nearest mosaic pixel: {data.sampled_ra.toFixed(6)}°,{' '}
            {data.sampled_dec.toFixed(6)}°. This measures sky surface
            brightness, including blends and background. It is not a calibrated
            flux of the named object.
          </div>
          {points.length ? (
            <svg
              className="spectral-chart"
              viewBox="0 0 760 300"
              role="img"
              aria-label="Measured SPHEREx spectrum in MJy per steradian; gaps have no interpolated values"
            >
              {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
                <g key={fraction}>
                  <line
                    x1="70"
                    x2="710"
                    y1={y(low + fraction * (high - low))}
                    y2={y(low + fraction * (high - low))}
                    className="chart-grid"
                  />
                  <text
                    x="62"
                    y={y(low + fraction * (high - low)) + 4}
                    textAnchor="end"
                  >
                    {(low + fraction * (high - low)).toPrecision(3)}
                  </text>
                </g>
              ))}
              {[1, 2, 3, 4, 5].map((wave) => (
                <text key={wave} x={x(wave)} y="275" textAnchor="middle">
                  {wave} µm
                </text>
              ))}
              {points.map((point) => (
                <circle
                  key={point.channel}
                  cx={x(point.wavelength_um)}
                  cy={y(point.surface_brightness_mjy_sr!)}
                  r="3"
                  fill="var(--cyan)"
                >
                  <title>
                    Channel {point.channel}: {point.wavelength_um.toFixed(4)}{' '}
                    µm, {point.surface_brightness_mjy_sr!.toPrecision(5)}{' '}
                    MJy/sr, {point.nhits} hits
                  </title>
                </circle>
              ))}
            </svg>
          ) : (
            <p>
              No channels pass the quality mask at this pixel. Inspect the
              channel table or choose another position.
            </p>
          )}
          <p className="panel-footnote">
            Error bars unavailable: the archive cube has no variance layer.
            Blank/rejected channels are gaps; molecular detections and
            atmospheric classes are not inferred.
          </p>
          <Downloads jobs={job ? [job] : []} />
          <a
            className="text-link"
            href={data.source_url}
            target="_blank"
            rel="noreferrer"
          >
            Original DR1 FITS cube ↗
          </a>
          <details className="quality-notes">
            <summary>ALL 102 CHANNELS / VALUES & QUALITY</summary>
            <div className="observation-scroll">
              <table className="observation-table">
                <thead>
                  <tr>
                    <th>Channel</th>
                    <th>λ µm</th>
                    <th>MJy/sr</th>
                    <th>Hits</th>
                    <th>Flags</th>
                    <th>Quality</th>
                  </tr>
                </thead>
                <tbody>
                  {data.samples.map((sample) => (
                    <tr key={sample.channel}>
                      <td>
                        {sample.channel} / D{sample.detector}
                      </td>
                      <td>{sample.wavelength_um.toFixed(4)}</td>
                      <td>
                        {sample.surface_brightness_mjy_sr?.toPrecision(5) ??
                          '—'}
                      </td>
                      <td>{sample.nhits}</td>
                      <td>0x{sample.flags.toString(16)}</td>
                      <td>{sample.exclusion_reason ?? 'usable'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          {data.warnings.map((warning) => (
            <p className="quality-warning" key={warning}>
              {warning}
            </p>
          ))}
        </Panel>
      )}
    </div>
  )
}
