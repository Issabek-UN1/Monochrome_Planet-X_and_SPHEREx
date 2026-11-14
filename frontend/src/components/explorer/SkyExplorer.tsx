import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Compass,
  Download,
  Film,
  Layers,
  MinusCircle,
  Play,
  Radio,
  RefreshCw,
  Search,
  Satellite,
} from 'lucide-react'
import { CURATED_TARGETS, spherexApi, type EnhancedTarget } from '../../api/client'
import type { Job, SearchResult } from '@monochrome-spherex/api-client'

interface SkyExplorerProps {
  initialTarget?: EnhancedTarget | null
}

export const SkyExplorer: React.FC<SkyExplorerProps> = ({ initialTarget }) => {
  const [source, setSource] = useState<'spherex' | 'neossat'>('spherex')
  // A new mission/target starts a fresh request session; cleanup aborts the previous session.
  return <SkyExplorerSession
    key={`${source}:${initialTarget?.id}:${initialTarget?.ra}:${initialTarget?.dec}`}
    initialTarget={initialTarget} source={source} onSourceChange={setSource}
  />
}

interface SkyExplorerSessionProps extends SkyExplorerProps {
  source: 'spherex' | 'neossat'
  onSourceChange: (source: 'spherex' | 'neossat') => void
}

const SkyExplorerSession: React.FC<SkyExplorerSessionProps> = ({ initialTarget, source, onSourceChange }) => {

  // Search parameters
  const [ra, setRa] = useState<number>(initialTarget?.ra ?? 133.7951)
  const [dec, setDec] = useState<number>(initialTarget?.dec ?? -7.2451)
  const [radiusDeg, setRadiusDeg] = useState<number>(initialTarget?.radius_deg ?? 0.1)
  const [fovDeg, setFovDeg] = useState<number>(initialTarget?.fov_deg ?? 0.2)
  const sizePx = 256

  // Search state
  const [isSearching, setIsSearching] = useState(false)
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [selectedObsIds, setSelectedObsIds] = useState<string[]>([])
  const searchAbort = useRef<AbortController | null>(null)
  const submitAbort = useRef<AbortController | null>(null)

  // Job processing state
  const [activeJob, setActiveJob] = useState<Job | null>(null)
  const [isJobSubmitting, setIsJobSubmitting] = useState(false)
  const [jobError, setJobError] = useState<string | null>(null)

  const handleSearch = useCallback(async (searchRa = ra, searchDec = dec) => {
    searchAbort.current?.abort()
    submitAbort.current?.abort()
    const controller = new AbortController()
    searchAbort.current = controller
    setIsSearching(true)
    setSearchError(null)
    setSearchResult(null)
    setSelectedObsIds([])
    setActiveJob(null)
    setIsJobSubmitting(false)
    setJobError(null)
    try {
      const result = await spherexApi.search({ source, ra: searchRa, dec: searchDec,
        radius_deg: radiusDeg, limit: 100 }, controller.signal)
      if (controller.signal.aborted) return
      setSearchResult(result)
      const group = result.observations.filter(o => o.detector === result.observations[0]?.detector)
      setSelectedObsIds(group.slice(0, 2).map(o => o.id))
    } catch (err) {
      if (!controller.signal.aborted) setSearchError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      if (!controller.signal.aborted) setIsSearching(false)
    }
  }, [source, ra, dec, radiusDeg])

  // Cancel requests on navigation; changing sources cannot reuse old observation IDs.
  useEffect(() => () => { searchAbort.current?.abort(); submitAbort.current?.abort() }, [])
  const handleCreateJob = async (kind: 'blink' | 'difference' | 'stack' | 'cutout') => {
    if (!searchResult || !selectedObsIds.length) return
    submitAbort.current?.abort()
    const controller = new AbortController()
    submitAbort.current = controller
    setIsJobSubmitting(true)
    setJobError(null)
    setActiveJob(null)
    try {
      const isNeossat = source === 'neossat'
      const job = await spherexApi.createJob({ source, kind, observation_ids: selectedObsIds,
        ra: searchResult.query.ra, dec: searchResult.query.dec, fov_deg: fovDeg, size_px: sizePx,
        reject_flags: isNeossat ? 0 : 4292870143, subtract_zodi: !isNeossat }, controller.signal)
      if (!controller.signal.aborted) setActiveJob(job)
    } catch (err) {
      if (!controller.signal.aborted) {
        setJobError(err instanceof Error ? err.message : 'Could not submit job')
        setIsJobSubmitting(false)
      }
    }
  }

  const jobId = activeJob?.id
  useEffect(() => {
    if (!jobId) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    const started = Date.now()
    const poll = async () => {
      try {
        const job = await spherexApi.getJob(jobId, controller.signal)
        if (controller.signal.aborted) return
        setActiveJob(job)
        if (job.status === 'succeeded' || job.status === 'failed') {
          setIsJobSubmitting(false)
          if (job.status === 'failed') setJobError(job.error || 'Processing failed')
          return
        }
        if (Date.now() - started > 15 * 60_000) throw new Error('Processing is taking too long. Check that the worker is running; the job remains saved.')
        timer = setTimeout(poll, 1800)
      } catch (err) {
        if (!controller.signal.aborted) {
          setJobError(err instanceof Error ? err.message : 'Unable to read job status')
          setIsJobSubmitting(false)
        }
      }
    }
    void poll()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [jobId])

  const toggleSelectObs = (id: string) => {
    if (selectedObsIds.includes(id)) {
      setSelectedObsIds(selectedObsIds.filter((item) => item !== id))
    } else {
      setSelectedObsIds([...selectedObsIds, id].slice(0, 12))
    }
  }

  const artifacts = activeJob?.artifacts ?? []

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      {/* Top Section: Title & Mission Quick Selector */}
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center space-x-2 text-xs font-mono text-cyan-400">
            <Compass className="h-4 w-4" />
            <span>ASTROMETRIC POINTING & MULTI-EPOCH PIPELINE</span>
          </div>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-white">
            SPHEREx & NEOSSat Sky Explorer
          </h2>
          <p className="mt-1 text-sm text-neutral-400">
            Query infrared sky cutouts across SPHEREx survey epochs or CADC NEOSSat asteroid tracks.
          </p>
        </div>

        {/* Observatory Source Selector */}
        <div className="flex items-center space-x-2 rounded-xl border border-white/15 bg-black/60 p-1 font-mono text-xs">
          <button
            onClick={() => onSourceChange('spherex')}
            className={`flex items-center space-x-1.5 rounded-lg px-3 py-1.5 transition-colors ${
              source === 'spherex'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Radio className="h-3.5 w-3.5" />
            <span>SPHEREx IR</span>
          </button>
          <button
            onClick={() => onSourceChange('neossat')}
            className={`flex items-center space-x-1.5 rounded-lg px-3 py-1.5 transition-colors ${
              source === 'neossat'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Satellite className="h-3.5 w-3.5" />
            <span>NEOSSat Optical</span>
          </button>
        </div>
      </div>

      {/* Preset Target Buttons */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-neutral-400 mr-1">CHALLENGE TARGETS:</span>
        {CURATED_TARGETS.map((target) => (
          <button
            key={target.id}
            onClick={() => {
              setRa(target.ra)
              setDec(target.dec)
              handleSearch(target.ra, target.dec)
            }}
            className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-mono text-neutral-300 hover:border-amber-500/50 hover:bg-amber-500/10 hover:text-amber-300 transition-colors"
          >
            {target.name}
          </button>
        ))}
      </div>

      {searchResult?.observations.some(o => o.synthetic) && <p role="status" className="mb-4 text-amber-300">SYNTHETIC DEMO DATA — generated by the backend, not telescope observations.</p>}
      {searchResult?.warnings?.map(w => <p key={w} className="mb-2 text-sm text-amber-200">{w}</p>)}
      {activeJob?.warnings?.map(w => <p key={w} className="mb-2 text-sm text-amber-200">{w}</p>)}
      {jobError && <p role="alert" className="mb-4 text-red-300">{jobError}</p>}

      {/* Grid: Left Search Panel / Right Execution & Results */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left Column: Search & Observations (5 cols) */}
        <div className="space-y-6 lg:col-span-5">
          {/* Coordinates Input Card */}
          <div className="rounded-2xl border border-white/10 bg-neutral-950/70 p-5 backdrop-blur-md">
            <h3 className="flex items-center space-x-2 font-mono text-xs font-semibold text-neutral-300 uppercase tracking-wider">
              <Search className="h-3.5 w-3.5 text-amber-400" />
              <span>Sky Search Parameters (ICRS)</span>
            </h3>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <label className="block font-mono text-[11px] text-neutral-400">Right Ascension (RA °)</label>
                <input
                  type="number"
                  step="0.0001"
                  value={ra}
                  onChange={(e) => setRa(parseFloat(e.target.value) || 0)}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-black/60 px-3 py-2 font-mono text-sm text-white focus:border-amber-400 focus:outline-none"
                  placeholder="0.0 - 360.0"
                />
              </div>

              <div>
                <label className="block font-mono text-[11px] text-neutral-400">Declination (Dec °)</label>
                <input
                  type="number"
                  step="0.0001"
                  value={dec}
                  onChange={(e) => setDec(parseFloat(e.target.value) || 0)}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-black/60 px-3 py-2 font-mono text-sm text-white focus:border-amber-400 focus:outline-none"
                  placeholder="-90.0 - 90.0"
                />
              </div>

              <div>
                <label className="block font-mono text-[11px] text-neutral-400">Search Radius (°)</label>
                <input
                  type="number"
                  step="0.01"
                  value={radiusDeg}
                  onChange={(e) => setRadiusDeg(parseFloat(e.target.value) || 0.05)}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-black/60 px-3 py-2 font-mono text-sm text-white focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-mono text-[11px] text-neutral-400">Output FOV (°)</label>
                <input
                  type="number"
                  step="0.05"
                  value={fovDeg}
                  onChange={(e) => setFovDeg(parseFloat(e.target.value) || 0.1)}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-black/60 px-3 py-2 font-mono text-sm text-white focus:border-amber-400 focus:outline-none"
                />
              </div>
            </div>

            <button
              onClick={() => handleSearch()}
              disabled={isSearching}
              className="mt-5 flex w-full items-center justify-center space-x-2 rounded-xl border border-amber-500/40 bg-amber-500/10 py-2.5 font-mono text-xs font-semibold text-amber-300 hover:bg-amber-500/20 disabled:opacity-50 transition-colors"
            >
              {isSearching ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span>{isSearching ? 'SEARCHING ARCHIVE...' : `QUERY ${source.toUpperCase()} OBSERVATIONS`}</span>
            </button>

            {searchError && (
              <div className="mt-3 flex items-center space-x-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs font-mono text-red-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{searchError}</span>
              </div>
            )}
          </div>

          {/* Observations Result List */}
          <div className="rounded-2xl border border-white/10 bg-neutral-950/70 p-5 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center space-x-2 font-mono text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                <Layers className="h-3.5 w-3.5 text-cyan-400" />
                <span>Observations ({searchResult?.observations?.length ?? 0})</span>
              </h3>
              {searchResult?.possibly_truncated && (
                <span className="font-mono text-[10px] text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded">
                  TRUNCATED
                </span>
              )}
            </div>

            <div className="mt-4 max-h-[380px] space-y-2.5 overflow-y-auto pr-1">
              {!searchResult && !isSearching && (
                <div className="py-8 text-center font-mono text-xs text-neutral-400">
                  Select a challenge target or enter coordinates to query data.
                </div>
              )}

              {searchResult?.observations.map((obs) => {
                const isSelected = selectedObsIds.includes(obs.id)
                return (
                  <div
                    key={obs.id}
                    onClick={() => toggleSelectObs(obs.id)}
                    className={`cursor-pointer rounded-xl border p-3 transition-all ${
                      isSelected
                        ? 'border-cyan-500/50 bg-cyan-950/20 text-white'
                        : 'border-white/5 bg-black/40 text-neutral-400 hover:border-white/15'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="font-semibold text-cyan-300">
                        {obs.detector ? `DETECTOR ${obs.detector}` : obs.collection}
                      </span>
                      <span className="text-neutral-400">MJD: {obs.mjd_start ? obs.mjd_start.toFixed(1) : 'N/A'}</span>
                    </div>

                    <div className="mt-1 flex items-center justify-between text-[11px] font-mono text-neutral-400">
                      <span>ID: {obs.id.slice(0, 16)}...</span>
                      <span className="text-amber-400">
                        {obs.wavelength_min_um && obs.wavelength_max_um
                          ? `${obs.wavelength_min_um.toFixed(2)}–${obs.wavelength_max_um.toFixed(2)} µm`
                          : 'BAND RANGE N/A'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Processing Pipeline & Visual Artifacts (7 cols) */}
        <div className="space-y-6 lg:col-span-7">
          {/* Action Trigger Bar */}
          <div className="rounded-2xl border border-white/10 bg-neutral-950/70 p-5 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <h3 className="font-mono text-xs font-semibold text-neutral-300 uppercase tracking-wider flex items-center space-x-2">
                <Play className="h-3.5 w-3.5 text-amber-400" />
                <span>Science Processing Engine ({selectedObsIds.length} Selected)</span>
              </h3>
              <span className="font-mono text-[10px] text-neutral-400">FOV: {fovDeg}° / {sizePx}px</span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <button
                onClick={() => handleCreateJob('blink')}
                disabled={selectedObsIds.length < 2 || isJobSubmitting}
                className="flex flex-col items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-950/20 py-3 font-mono text-xs font-semibold text-cyan-300 hover:bg-cyan-900/30 disabled:opacity-40 transition-colors"
              >
                <Film className="h-4 w-4 mb-1" />
                <span>GENERATE BLINK</span>
                <span className="text-[9px] text-cyan-400/70 font-normal">2–12 Epochs</span>
              </button>

              <button
                onClick={() => handleCreateJob('difference')}
                disabled={source === 'neossat' || selectedObsIds.length !== 2 || isJobSubmitting}
                className="flex flex-col items-center justify-center rounded-xl border border-amber-500/30 bg-amber-950/20 py-3 font-mono text-xs font-semibold text-amber-300 hover:bg-amber-900/30 disabled:opacity-40 transition-colors"
              >
                <MinusCircle className="h-4 w-4 mb-1" />
                <span>DIFFERENCE</span>
                <span className="text-[9px] text-amber-400/70 font-normal">Science − Ref</span>
              </button>

              <button
                onClick={() => handleCreateJob('stack')}
                disabled={source === 'neossat' || selectedObsIds.length < 2 || isJobSubmitting}
                className="flex flex-col items-center justify-center rounded-xl border border-purple-500/30 bg-purple-950/20 py-3 font-mono text-xs font-semibold text-purple-300 hover:bg-purple-900/30 disabled:opacity-40 transition-colors"
              >
                <Layers className="h-4 w-4 mb-1" />
                <span>CO-ADD STACK</span>
                <span className="text-[9px] text-purple-400/70 font-normal">Inverse Variance</span>
              </button>

              <button
                onClick={() => handleCreateJob('cutout')}
                disabled={selectedObsIds.length !== 1 || isJobSubmitting}
                className="flex flex-col items-center justify-center rounded-xl border border-white/15 bg-white/5 py-3 font-mono text-xs font-semibold text-neutral-300 hover:bg-white/10 disabled:opacity-40 transition-colors"
              >
                <Search className="h-4 w-4 mb-1" />
                <span>SINGLE CUTOUT</span>
                <span className="text-[9px] text-neutral-400 font-normal">1 Obs</span>
              </button>
            </div>

            {/* Job Status Banner */}
            {activeJob && (
              <div className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-black/60 px-4 py-2.5 font-mono text-xs">
                <div className="flex items-center space-x-2">
                  {activeJob.status === 'succeeded' ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : activeJob.status === 'failed' ? (
                    <AlertCircle className="h-4 w-4 text-red-400" />
                  ) : (
                    <RefreshCw className="h-4 w-4 text-amber-400 animate-spin" />
                  )}
                  <span>JOB {activeJob.id.slice(0, 8)}... [{activeJob.request.kind.toUpperCase()}]: {activeJob.status.toUpperCase()}</span>
                </div>
                <span className="text-neutral-400 text-[10px]">{artifacts.length} ARTIFACTS</span>
              </div>
            )}
          </div>

          {/* Result Viewer & Artifacts Display */}
          <div className="rounded-2xl border border-white/10 bg-neutral-950/70 p-6 backdrop-blur-md">
            <h3 className="font-mono text-xs font-semibold text-neutral-300 uppercase tracking-wider">
              Scientific Visualizer & Artifacts
            </h3>

            {activeJob?.status === 'succeeded' && artifacts.length > 0 ? (
              <div className="mt-4 space-y-4">
                {/* Main Visual Display */}
                <div className="relative flex min-h-[340px] items-center justify-center overflow-hidden rounded-xl border border-white/15 bg-black p-4">
                  {(() => {
                    const visualArtifact =
                      artifacts.find((a) => a.name.endsWith('.gif') || a.media_type.includes('gif')) ||
                      artifacts.find((a) => a.name.endsWith('.png') || a.media_type.includes('png'))

                    if (visualArtifact) {
                      return (
                        <div className="relative flex flex-col items-center">
                          <img
                            src={spherexApi.artifactUrl(visualArtifact)}
                            alt={visualArtifact.name}
                            className="max-h-[300px] rounded-lg border border-white/20 shadow-2xl object-contain"
                          />
                          <div className="mt-2 flex items-center space-x-3 font-mono text-xs text-neutral-400">
                            <span>FILE: {visualArtifact.name}</span>
                            <span>TYPE: {visualArtifact.media_type}</span>
                          </div>
                        </div>
                      )
                    }
                    return null
                  })()}
                </div>

                {/* Downloads & FITS files */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  {artifacts.map((artifact, i) => (
                    <a
                      key={i}
                      href={spherexApi.artifactUrl(artifact)}
                      target="_blank"
                      rel="noreferrer"
                      download
                      className="flex items-center space-x-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 font-mono text-xs text-neutral-300 hover:border-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>{artifact.name}</span>
                    </a>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-4 flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-black/40 p-8 text-center font-mono">
                <Film className="h-10 w-10 text-neutral-400 mb-3" />
                <p className="text-sm text-neutral-400">No active job completed yet.</p>
                <p className="mt-1 text-xs text-neutral-400 max-w-sm">
                  Select two observation epochs and click <span className="text-cyan-400 font-semibold">GENERATE BLINK</span> or <span className="text-amber-400 font-semibold">DIFFERENCE</span> to reveal proper-motion candidates.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
