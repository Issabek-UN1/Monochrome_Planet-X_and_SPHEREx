import React, { useState } from 'react'
import {
  ArrowRight,
  Compass,
  Eye,
  Layers,
  Maximize2,
  RefreshCw,
  Sparkles,
  X,
  Zap,
} from 'lucide-react'
import type { EnhancedTarget } from '../../api/client'

interface ApertureModalProps {
  target: EnhancedTarget | null
  onClose: () => void
  onOpenExplorer: (target: EnhancedTarget) => void
  onOpenSpectral: (target: EnhancedTarget) => void
}

export const ApertureModal: React.FC<ApertureModalProps> = ({
  target,
  onClose,
  onOpenExplorer,
  onOpenSpectral,
}) => {
  if (!target) return null

  const [wipePercent, setWipePercent] = useState(50)
  const [blinkEpoch, setBlinkEpoch] = useState<1 | 2>(1)
  const [isBlinking, setIsBlinking] = useState(false)

  // Blink interval if toggled
  React.useEffect(() => {
    if (!isBlinking) return
    const interval = setInterval(() => {
      setBlinkEpoch((prev) => (prev === 1 ? 2 : 1))
    }, 850)
    return () => clearInterval(interval)
  }, [isBlinking])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-2xl p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="relative flex h-full max-h-[880px] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/15 bg-neutral-950/95 shadow-2xl">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="flex items-center space-x-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-400">
              <Compass className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-mono text-base font-bold text-white tracking-wide">
                  {target.name}
                </h3>
                <span className="rounded bg-amber-500/20 px-2 py-0.5 font-mono text-[10px] text-amber-300 border border-amber-500/40">
                  {target.category}
                </span>
              </div>
              <p className="font-mono text-xs text-neutral-400">
                ICRS Coordinates: RA {target.ra.toFixed(4)}° / DEC {target.dec.toFixed(4)}°
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsBlinking(!isBlinking)}
              className={`flex items-center space-x-1.5 rounded-lg border px-3 py-1.5 font-mono text-xs transition-colors ${
                isBlinking
                  ? 'border-amber-500/50 bg-amber-500/20 text-amber-300'
                  : 'border-white/15 bg-white/5 text-neutral-300 hover:bg-white/10'
              }`}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isBlinking ? 'animate-spin' : ''}`} />
              <span>{isBlinking ? 'STOP BLINK' : 'AUTO BLINK'}</span>
            </button>

            <button
              onClick={onClose}
              className="rounded-lg border border-white/15 bg-white/5 p-2 text-neutral-400 hover:bg-white/10 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content Body: Split Wipe Viewer (Left) + Astrometric Telemetry (Right) */}
        <div className="grid flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-12">
          {/* Left Column: High-Res Split-Wipe Field (8 cols) */}
          <div className="relative flex flex-col justify-between bg-black p-6 lg:col-span-8 border-b lg:border-b-0 lg:border-r border-white/10">
            {/* Split-Wipe Interactive Viewer */}
            <div className="relative my-auto flex h-[480px] w-full items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-neutral-950 select-none">
              {/* Background: Epoch 2 */}
              <img
                src={target.imageUrlEpoch2}
                alt="Epoch 2"
                className="absolute inset-0 h-full w-full object-cover"
              />

              {/* Foreground: Epoch 1 (clipped via wipePercent) */}
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${wipePercent}%` }}
              >
                <img
                  src={target.imageUrlEpoch1}
                  alt="Epoch 1"
                  className="absolute inset-0 h-full w-full max-w-none object-cover"
                  style={{ width: '100%' }}
                />
              </div>

              {/* Vertical Wipe Handle */}
              <div
                className="absolute top-0 bottom-0 z-20 w-0.5 bg-amber-400 cursor-ew-resize flex items-center justify-center shadow-[0_0_15px_#f59e0b]"
                style={{ left: `${wipePercent}%` }}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-amber-400 bg-neutral-950 text-amber-300 font-mono text-[10px] shadow-lg">
                  ↔
                </div>
              </div>

              {/* Screen Coordinate Overlays */}
              <div className="absolute top-4 left-4 z-10 rounded bg-black/75 backdrop-blur-md px-2.5 py-1 font-mono text-xs text-white border border-white/10">
                <span className="text-cyan-400 font-bold">EPOCH 01:</span> 2026.1 (JANUARY)
              </div>

              <div className="absolute top-4 right-4 z-10 rounded bg-black/75 backdrop-blur-md px-2.5 py-1 font-mono text-xs text-white border border-white/10">
                <span className="text-amber-400 font-bold">EPOCH 02:</span> 2026.7 (JULY)
              </div>

              {/* Center Crosshair Target Marker */}
              <div className="pointer-events-none absolute z-20 flex flex-col items-center justify-center">
                <div className="relative h-12 w-12 rounded-full border border-dashed border-amber-400/80 animate-spin" style={{ animationDuration: '8s' }} />
                <div className="absolute h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_10px_#f59e0b]" />
              </div>
            </div>

            {/* Wipe Slider Controls */}
            <div className="mt-4 flex items-center space-x-4 font-mono text-xs text-neutral-400">
              <span>EPOCH 01</span>
              <input
                type="range"
                min="0"
                max="100"
                value={wipePercent}
                onChange={(e) => setWipePercent(parseInt(e.target.value))}
                className="h-2 w-full cursor-pointer rounded-lg bg-neutral-800 accent-amber-400"
              />
              <span>EPOCH 02</span>
              <span className="min-w-[45px] text-right font-bold text-amber-400">{wipePercent}%</span>
            </div>
          </div>

          {/* Right Column: Telemetry & Actions (4 cols) */}
          <div className="flex flex-col justify-between p-6 lg:col-span-4 space-y-6">
            <div className="space-y-5">
              <div>
                <span className="font-mono text-[11px] text-neutral-400 uppercase tracking-wider">
                  Description & Scientific Context
                </span>
                <p className="mt-1 text-sm text-neutral-300 leading-relaxed font-sans">
                  {target.description}
                </p>
              </div>

              {/* Data Table */}
              <div className="rounded-xl border border-white/10 bg-black/50 p-4 font-mono text-xs space-y-2.5">
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-neutral-400">Proper Motion Rate:</span>
                  <span className="text-cyan-400 font-bold">{target.apparentMotion}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-neutral-400">Estimated Distance:</span>
                  <span className="text-white">{target.distanceLy}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-neutral-400">Effective Temp:</span>
                  <span className="text-amber-400 font-bold">{target.temperatureK}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Recommended FOV:</span>
                  <span className="text-white">{target.fov_deg}°</span>
                </div>
              </div>

              {/* SPHEREx Mission Note */}
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs font-sans text-neutral-300 leading-relaxed">
                <span className="font-mono text-[10px] text-amber-400 font-bold block mb-1 uppercase tracking-wide">
                  SPHEREx Mission Relevance:
                </span>
                {target.spherexRelevance}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 pt-4 border-t border-white/10 font-mono text-xs">
              <button
                onClick={() => {
                  onClose()
                  onOpenExplorer(target)
                }}
                className="flex w-full items-center justify-center space-x-2 rounded-xl border border-cyan-500/40 bg-cyan-950/20 py-3 font-semibold text-cyan-300 hover:bg-cyan-900/30 transition-colors"
              >
                <Compass className="h-4 w-4" />
                <span>LOAD INTO SKY EXPLORER</span>
                <ArrowRight className="h-4 w-4" />
              </button>

              <button
                onClick={() => {
                  onClose()
                  onOpenSpectral(target)
                }}
                className="flex w-full items-center justify-center space-x-2 rounded-xl border border-purple-500/40 bg-purple-950/20 py-3 font-semibold text-purple-300 hover:bg-purple-900/30 transition-colors"
              >
                <Layers className="h-4 w-4" />
                <span>ANALYZE 102 SPECTRAL BANDS</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
