import React, { useState } from 'react'
import {
  Award,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Layers,
  Sparkles,
  Zap,
} from 'lucide-react'
import { CURATED_TARGETS, type EnhancedTarget } from '../../api/client'

interface SpectralLabProps {
  initialTarget?: EnhancedTarget | null
}

// SPHEREx 6 detectors wavelength coverage
const DETECTORS_INFO = [
  { id: 1, name: 'Detector 1', range: '0.75 – 1.11 µm', bands: '1 – 17', color: '#38bdf8' },
  { id: 2, name: 'Detector 2', range: '1.11 – 1.64 µm', bands: '18 – 34', color: '#60a5fa' },
  { id: 3, name: 'Detector 3', range: '1.64 – 2.42 µm', bands: '35 – 51', color: '#818cf8' },
  { id: 4, name: 'Detector 4', range: '2.42 – 3.82 µm', bands: '52 – 68', color: '#f59e0b' },
  { id: 5, name: 'Detector 5', range: '3.82 – 4.42 µm', bands: '69 – 85', color: '#fb923c' },
  { id: 6, name: 'Detector 6', range: '4.42 – 5.00 µm', bands: '86 – 102', color: '#ff6b35' },
]

export const SpectralLab: React.FC<SpectralLabProps> = ({ initialTarget }) => {
  const [selectedTarget, setSelectedTarget] = useState<EnhancedTarget>(
    initialTarget || CURATED_TARGETS[0]
  )
  const [currentBand, setCurrentBand] = useState<number>(58) // Mid-IR band ~3.0 µm
  const [verified, setVerified] = useState<boolean>(false)

  // Calculate wavelength from band index 1..102
  const wavelength = 0.75 + ((currentBand - 1) / 101) * (5.0 - 0.75)

  // Active detector based on band
  const activeDetector =
    currentBand <= 17 ? 1 :
    currentBand <= 34 ? 2 :
    currentBand <= 51 ? 3 :
    currentBand <= 68 ? 4 :
    currentBand <= 85 ? 5 : 6

  // Spectral absorption lines
  const getAbsorptionMarker = (w: number) => {
    if (Math.abs(w - 1.5) < 0.1) return 'H₂O Water Ice (1.5 µm)'
    if (Math.abs(w - 1.65) < 0.1) return 'CH₄ Methane (1.65 µm)'
    if (Math.abs(w - 2.0) < 0.1) return 'H₂O Ice Absorption (2.0 µm)'
    if (Math.abs(w - 3.3) < 0.15) return 'CH₄ Strong Hydrocarbon (3.3 µm)'
    if (Math.abs(w - 4.26) < 0.12) return 'CO₂ Carbon Dioxide (4.26 µm)'
    if (Math.abs(w - 4.67) < 0.12) return 'CO Carbon Monoxide (4.67 µm)'
    return null
  }

  const absorptionNotice = getAbsorptionMarker(wavelength)

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
<p role="status" className="mb-4 rounded border border-amber-500/40 p-4 text-amber-200">ILLUSTRATIVE PROTOTYPE: no measured 102-channel spectrum or automated source verification is available. Slider wavelengths are approximate.</p>
      {/* Header Banner */}
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center space-x-2 text-xs font-mono text-purple-400">
            <Layers className="h-4 w-4" />
            <span>SPECTRO-PHOTOMETRIC SPECTROSCOPY // 102 BANDS</span>
          </div>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-white">
            SPHEREx 102-Band Spectral Laboratory
          </h2>
          <p className="mt-1 text-sm text-neutral-400">
            Analyze the infrared spectral energy distribution (SED). Calibrated spectral extraction is planned; these controls are illustrative.
          </p>
        </div>

        {/* Target Switcher */}
        <div className="flex items-center space-x-2">
          <span className="font-mono text-xs text-neutral-400">INSPECT TARGET:</span>
          <select
            value={selectedTarget.id}
            onChange={(e) => {
              const t = CURATED_TARGETS.find((item) => item.id === e.target.value)
              if (t) setSelectedTarget(t)
            }}
            className="rounded-lg border border-white/20 bg-neutral-900 px-3 py-1.5 font-mono text-xs text-white focus:border-amber-400 focus:outline-none"
          >
            {CURATED_TARGETS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.category})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Grid: Visualizer + SED Graph (Left) & Telemetry / Verification (Right) */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left Column: Spectral Slider & False-Color Viewport (8 cols) */}
        <div className="space-y-6 lg:col-span-8">
          {/* 102 Bands Slider Control Box */}
          <div className="rounded-2xl border border-white/10 bg-neutral-950/70 p-6 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 font-mono text-xs">
                <span className="text-neutral-400">ACTIVE BAND:</span>
                <span className="rounded bg-amber-500/20 px-2 py-0.5 font-bold text-amber-300 border border-amber-500/40">
                  BAND #{currentBand} / 102
                </span>
                <span className="text-cyan-400 font-semibold">{wavelength.toFixed(3)} µm</span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentBand((prev) => Math.max(1, prev - 1))}
                  className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-neutral-300 hover:bg-white/10"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setCurrentBand((prev) => Math.min(102, prev + 1))}
                  className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-neutral-300 hover:bg-white/10"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Slider track */}
            <div className="mt-5">
              <input
                type="range"
                min="1"
                max="102"
                value={currentBand}
                onChange={(e) => setCurrentBand(parseInt(e.target.value))}
                className="w-full h-2 rounded-lg bg-neutral-800 accent-amber-400 cursor-pointer"
              />
            </div>

            {/* Detector Range Labels */}
            <div className="mt-3 grid grid-cols-6 gap-1 text-center font-mono text-[10px]">
              {DETECTORS_INFO.map((det) => (
                <div
                  key={det.id}
                  onClick={() => setCurrentBand(parseInt(det.bands.split(' – ')[0]))}
                  className={`cursor-pointer rounded p-1 transition-all ${
                    activeDetector === det.id
                      ? 'border border-amber-400/60 bg-amber-500/20 text-white font-bold'
                      : 'border border-white/5 bg-black/40 text-neutral-400 hover:border-white/20'
                  }`}
                >
                  <div>DET {det.id}</div>
                  <div className="text-[8px] text-neutral-400">{det.range}</div>
                </div>
              ))}
            </div>

            {/* Absorption Line Alert */}
            {absorptionNotice && (
              <div className="mt-4 flex items-center space-x-2 rounded-xl border border-cyan-500/30 bg-cyan-950/20 px-3 py-2 font-mono text-xs text-cyan-300">
                <Sparkles className="h-4 w-4 text-cyan-400 shrink-0" />
                <span>MOLECULAR TRANSITION: {absorptionNotice}</span>
              </div>
            )}
          </div>

          {/* False-Color Simulated Infrared Viewport */}
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-neutral-950/70 p-6 backdrop-blur-md">
            <h3 className="font-mono text-xs font-semibold text-neutral-300 uppercase tracking-wider flex items-center justify-between">
              <span>Simulated Band Imagery ({wavelength.toFixed(2)} µm)</span>
              <span className="text-[10px] text-amber-400">{selectedTarget.name}</span>
            </h3>

            <div className="relative mt-4 flex h-[280px] w-full items-center justify-center overflow-hidden rounded-xl bg-black border border-white/10">
              <img
                src={selectedTarget.imageUrlEpoch1}
                alt="Spectral band view"
                className="h-full w-full object-cover opacity-80"
                style={{
                  filter: `hue-rotate(${currentBand * 2.5}deg) saturate(${1 + currentBand * 0.01})`,
                }}
              />

              {/* Thermal Infrared Overlay for Candidate */}
              <div
                className="absolute flex items-center justify-center transition-all duration-300"
                style={{
                  top: '50%',
                  left: '52%',
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <div
                  className="rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.max(8, currentBand * 0.35)}px`,
                    height: `${Math.max(8, currentBand * 0.35)}px`,
                    backgroundColor: currentBand > 50 ? '#ff6b35' : '#38bdf8',
                    boxShadow: currentBand > 50 ? '0 0 25px #ff6b35' : '0 0 10px #38bdf8',
                  }}
                />
              </div>

              {/* HUD Target Watermark */}
              <div className="absolute bottom-3 left-3 rounded bg-black/80 px-2 py-1 font-mono text-[10px] text-white/80 border border-white/10">
                <span>FLUX ESTIMATE: {(currentBand * 1.84 + 12).toFixed(1)} µJy</span>
              </div>
            </div>
          </div>

          {/* Spectral Energy Distribution (SED) SVG Plot */}
          <div className="rounded-2xl border border-white/10 bg-neutral-950/70 p-6 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <h3 className="font-mono text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                Spectral Energy Distribution (SED) Curve
              </h3>
              <span className="font-mono text-[10px] text-neutral-400">Peak Thermal Excess: ~3.8 µm</span>
            </div>

            {/* Synthetic SVG Curve */}
            <div className="mt-4 relative h-40 w-full">
              <svg className="h-full w-full overflow-visible" viewBox="0 0 500 120">
                {/* Grid lines */}
                <line x1="0" y1="100" x2="500" y2="100" stroke="#333" strokeWidth="1" />
                <line x1="0" y1="50" x2="500" y2="50" stroke="#222" strokeDasharray="4" />

                {/* Cold Planet X / Brown Dwarf SED Peak Curve */}
                <path
                  d="M 10 95 Q 120 90 220 70 T 360 20 T 480 85"
                  fill="none"
                  stroke="#ff6b35"
                  strokeWidth="3"
                />

                {/* Normal Star Background Curve (falls off in IR) */}
                <path
                  d="M 10 25 Q 120 40 220 80 T 480 95"
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                  strokeDasharray="3"
                />

                {/* Active Band Cursor */}
                <line
                  x1={10 + ((currentBand - 1) / 101) * 480}
                  y1="10"
                  x2={10 + ((currentBand - 1) / 101) * 480}
                  y2="105"
                  stroke="#f59e0b"
                  strokeWidth="2"
                />
              </svg>

              <div className="flex justify-between font-mono text-[9px] text-neutral-400 mt-2">
                <span>0.75 µm</span>
                <span className="text-cyan-400">--- Background Star</span>
                <span className="text-amber-400 font-bold">—— Cold Planet X / Brown Dwarf</span>
                <span>5.00 µm</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Physical Properties & Citizen Science Module (4 cols) */}
        <div className="space-y-6 lg:col-span-4">
          {/* Target Metadata Card */}
          <div className="rounded-2xl border border-white/10 bg-neutral-950/70 p-5 backdrop-blur-md">
            <h3 className="font-mono text-xs font-semibold text-neutral-300 uppercase tracking-wider">
              Astrophysical Profile
            </h3>

            <div className="mt-4 space-y-3 font-mono text-xs">
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-neutral-400">Target:</span>
                <span className="text-white font-semibold">{selectedTarget.name}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-neutral-400">Category:</span>
                <span className="text-amber-300">{selectedTarget.category}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-neutral-400">Equatorial (RA/Dec):</span>
                <span className="text-white">{selectedTarget.ra.toFixed(2)}°, {selectedTarget.dec.toFixed(2)}°</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-neutral-400">Proper Motion:</span>
                <span className="text-cyan-400 font-bold">{selectedTarget.apparentMotion}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-neutral-400">Est. Distance:</span>
                <span className="text-white">{selectedTarget.distanceLy}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-neutral-400">Effective Temp:</span>
                <span className="text-amber-400 font-bold">{selectedTarget.temperatureK}</span>
              </div>
            </div>

            <p className="mt-4 text-xs font-sans text-neutral-400 leading-relaxed">
              {selectedTarget.spherexRelevance}
            </p>
          </div>

          {/* Citizen Science Verification Form */}
          <div className="rounded-2xl border border-amber-500/30 bg-amber-950/10 p-5 backdrop-blur-md">
            <div className="flex items-center space-x-2">
              <Award className="h-5 w-5 text-amber-400" />
              <h3 className="font-mono text-xs font-semibold text-amber-300 uppercase tracking-wider">
                Citizen Science Verification
              </h3>
            </div>

            <p className="mt-2 text-xs font-sans text-neutral-400">
              Confirm this candidate as a legitimate moving body in the SPHEREx survey database.
            </p>

            <div className="mt-4 space-y-2.5 font-mono text-xs text-neutral-300">
              <label className="flex items-center space-x-2">
                <input type="checkbox" defaultChecked className="rounded accent-amber-400" />
                <span>Motion has not been verified by the application</span>
              </label>

              <label className="flex items-center space-x-2">
                <input type="checkbox" defaultChecked className="rounded accent-amber-400" />
                <span>Thermal IR excess confirmed</span>
              </label>

              <label className="flex items-center space-x-2">
                <input type="checkbox" className="rounded accent-amber-400" />
                <span>Flag for ground-based follow-up</span>
              </label>
            </div>

            <button
              onClick={() => setVerified(true)}
              disabled={true}
              className={`mt-5 flex w-full items-center justify-center space-x-2 rounded-xl py-2.5 font-mono text-xs font-semibold transition-colors ${
                verified
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-amber-500 text-neutral-950 hover:bg-amber-400'
              }`}
            >
              {verified ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>CANDIDATE LOGGED & VERIFIED</span>
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  <span>SUBMIT CANDIDATE VERIFICATION</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
