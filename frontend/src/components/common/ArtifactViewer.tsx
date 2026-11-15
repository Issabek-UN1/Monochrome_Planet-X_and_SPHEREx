import { useEffect, useState, type CSSProperties } from 'react'
import { Download, FileCode2, Maximize2, Search } from 'lucide-react'
import type { Artifact, Job } from '@monochrome-spherex/api-client'
import { spherexApi } from '../../api/client'
import { fitsImageHeader } from '../../utils/astronomy'
import { ErrorNotice } from './Panel'
export function FitsInspector({
  artifact,
}: {
  artifact: Artifact | undefined
}) {
  const [cards, setCards] = useState<string[]>([]),
    [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!artifact) return
    const controller = new AbortController()
    fetch(spherexApi.artifactUrl(artifact), {
      signal: controller.signal,
      headers: { Range: 'bytes=0-65535' },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('FITS header download failed')
        return response.arrayBuffer()
      })
      .then((buffer) => {
        if (!controller.signal.aborted) setCards(fitsImageHeader(buffer))
      })
      .catch((failure) => {
        if (!controller.signal.aborted)
          setError(
            failure instanceof Error ? failure.message : 'FITS parse failed',
          )
      })
    return () => controller.abort()
  }, [artifact])
  if (!artifact)
    return (
      <p className="empty-caption">
        Create a job to inspect the WCS header of its actual FITS product.
      </p>
    )
  return (
    <>
      <ErrorNotice message={error} />
      <pre className="fits-inspector" aria-label="FITS IMAGE WCS header">
        {error
          ? 'FITS HEADER UNAVAILABLE'
          : cards.length
            ? cards.join('\n')
            : 'Reading FITS IMAGE extension…'}
      </pre>
    </>
  )
}
export function Downloads({ jobs }: { jobs: Job[] }) {
  return (
    <div className="downloads">
      {jobs.flatMap((job) =>
        (job.artifacts ?? []).map((artifact) => (
          <a
            key={`${job.id}:${artifact.name}`}
            href={spherexApi.artifactUrl(artifact)}
            target="_blank"
            rel="noreferrer"
            download
          >
            <Download size={13} />
            {jobs.length > 1 ? `${job.request.kind} / ` : ''}
            {artifact.name}
          </a>
        )),
      )}
    </div>
  )
}
export function ArtifactViewer({ job }: { job: Job | null }) {
  const [zoom, setZoom] = useState(1),
    [showHeader, setShowHeader] = useState(false)
  const artifacts = job?.artifacts ?? []
  const visual =
    artifacts.find((item) => item.media_type === 'image/gif') ??
    artifacts.find((item) => item.media_type === 'image/png')
  const fits = artifacts.find((item) => item.name.endsWith('.fits'))
  return (
    <div className="artifact-viewer">
      <div className="viewer-toolbar">
        <span>
          <span className="status-dot" />
          OUTPUT / {job?.request.kind.toUpperCase() ?? 'AWAITING DISPATCH'}
        </span>
        <div>
          <button
            className="icon-button"
            onClick={() =>
              setZoom((old) => (old === 1 ? 2 : old === 2 ? 4 : 1))
            }
            aria-label="Cycle image zoom"
          >
            <Maximize2 size={15} />
            <span>{zoom}×</span>
          </button>
          <button
            className="icon-button"
            aria-label="Toggle FITS header"
            aria-pressed={showHeader}
            onClick={() => setShowHeader((old) => !old)}
          >
            <FileCode2 size={16} />
          </button>
        </div>
      </div>
      {showHeader ? (
        <FitsInspector key={fits?.url} artifact={fits} />
      ) : (
        <div className="image-stage">
          {visual ? (
            <div className="zoom-viewport">
              <ArchiveImage
                artifact={visual}
                alt={`Processed ${job?.request.kind} image; check provenance for data quality`}
                style={{ transform: `scale(${zoom})` }}
              />
            </div>
          ) : (
            <div className="awaiting-image">
              <Search size={38} />
              <strong>AWAITING SIGNAL</strong>
              <p>
                Run an archive job to receive an image.
                <br />
                No preview is substituted for telescope data.
              </p>
              <span className="crosshair-horizontal" />
              <span className="crosshair-vertical" />
            </div>
          )}
          <span className="image-scale">ICRS / NORTH ↑ / EAST ←</span>
        </div>
      )}
      {job?.status === 'succeeded' && <Downloads jobs={[job]} />}
    </div>
  )
}

export function ArchiveImage({
  artifact,
  alt,
  style,
}: {
  artifact: Artifact
  alt: string
  style?: CSSProperties
}) {
  const [failed, setFailed] = useState<string | null>(null)
  const src = spherexApi.artifactUrl(artifact)
  return failed === src ? (
    <div className="image-load-error" role="alert">
      <strong>IMAGE DOWNLOAD FAILED</strong>
      <span>Check the API connection or open the original product.</span>
      <a href={src} target="_blank" rel="noreferrer">
        Open {artifact.name} ↗
      </a>
    </div>
  ) : (
    <img src={src} alt={alt} style={style} onError={() => setFailed(src)} />
  )
}
