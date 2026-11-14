import React, { useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  Maximize2,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import { CURATED_TARGETS, type EnhancedTarget } from '../../api/client'
import { useTextScramble } from '../../hooks/useTextScramble'

interface AugeCarouselProps {
  onSelectTarget: (target: EnhancedTarget) => void
  onInspectTarget: (target: EnhancedTarget) => void
  onActiveTargetChange?: (target: EnhancedTarget) => void
}

export const AugeCarousel: React.FC<AugeCarouselProps> = ({
  onSelectTarget,
  onInspectTarget,
  onActiveTargetChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const selectedCategory = 'ALL'
  const [scrollPosition, setScrollPosition] = useState(0)
  const [isBlinking, setIsBlinking] = useState(true)
  const [blinkEpoch, setBlinkEpoch] = useState<1 | 2>(1)
  const [activeIndex, setActiveIndex] = useState(0)

  // Drag physics state
  const isDragging = useRef(false)
  const startX = useRef(0)
  const currentPos = useRef(0)
  const targetPos = useRef(0)
  const [renderVelocity, setRenderVelocity] = useState(0)
  const dragDistance = useRef(0)

  // Filtered targets
  const targets = CURATED_TARGETS.filter(
    (t) => selectedCategory === 'ALL' || t.category.toUpperCase() === selectedCategory
  )

  const activeTarget = targets[activeIndex] || targets[0]

  // Scramble text effect for active target
  const scrambledName = useTextScramble(activeTarget?.name || 'TARGET', 400)
  const scrambledCoords = useTextScramble(
    `RA ${activeTarget?.ra.toFixed(3)}° DEC ${activeTarget?.dec.toFixed(3)}°`,
    350
  )

  // Notify parent of active target for 3D sphere coordinate orientation
  useEffect(() => {
    if (activeTarget && onActiveTargetChange) {
      onActiveTargetChange(activeTarget)
    }
  }, [activeTarget, onActiveTargetChange])

  // Micro-Blink timer (auto-toggles between Epoch 1 and 2)
  useEffect(() => {
    if (!isBlinking) return
    const interval = setInterval(() => {
      setBlinkEpoch((prev) => (prev === 1 ? 2 : 1))
    }, 1100)
    return () => clearInterval(interval)
  }, [isBlinking])

  // Non-passive wheel event listener for smooth horizontal scrolling
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const handleNativeWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey) {
        e.preventDefault()
        targetPos.current += (e.deltaX || e.deltaY) * 1.2
      } else if (Math.abs(e.deltaY) > 5) {
        e.preventDefault()
        targetPos.current += e.deltaY * 1.3
      }
    }

    el.addEventListener('wheel', handleNativeWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleNativeWheel)
  }, [])

  // Virtual scroll & inertia loop (Lerp + Velocity Shear)
  useEffect(() => {
    let animationFrameId: number
    const maxScroll = Math.max(0, (targets.length - 1) * 380)

    const updatePhysics = () => {
      const prevPos = currentPos.current
      currentPos.current += (targetPos.current - currentPos.current) * 0.085
      const speed = currentPos.current - prevPos
      setRenderVelocity(previous => Math.abs(previous - speed) > 0.02 ? speed : previous)

      // Clamp target within bounds
      if (targetPos.current < 0) targetPos.current = 0
      if (targetPos.current > maxScroll) targetPos.current = maxScroll

      const position = currentPos.current
      setScrollPosition(previous => Math.abs(previous - position) > 0.05 ? position : previous)

      // Calculate active card index
      const closestIndex = Math.round(currentPos.current / 380)
      setActiveIndex(Math.max(0, Math.min(targets.length - 1, closestIndex)))

      animationFrameId = requestAnimationFrame(updatePhysics)
    }

    animationFrameId = requestAnimationFrame(updatePhysics)
    return () => cancelAnimationFrame(animationFrameId)
  }, [targets.length])

  // Pointer drag listeners
  const handlePointerDown = (e: React.PointerEvent) => {
    isDragging.current = true
    startX.current = e.clientX
    dragDistance.current = 0
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return
    const deltaX = startX.current - e.clientX
    dragDistance.current += Math.abs(deltaX)
    startX.current = e.clientX
    targetPos.current += deltaX * 1.5
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging.current) return
    isDragging.current = false
    try {
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {}
  }

  const handleCardClick = (target: EnhancedTarget) => {
    if (dragDistance.current < 10) {
      onSelectTarget(target)
    }
  }

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="relative z-10 flex min-h-[640px] w-full flex-col justify-between overflow-hidden py-4 select-none cursor-grab active:cursor-grabbing"
    >
      <p className="mx-auto text-xs text-amber-300">SYNTHETIC PREVIEW IMAGES — use Sky Explorer to query telescope observations.</p>
      {/* Giant Auge XP Counter-Parallax Background Typography */}
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden opacity-[0.035] select-none"
        style={{
          transform: `translateX(${-scrollPosition * 0.22}px)`,
        }}
      >
        <span className="font-mono text-[18vw] font-black uppercase tracking-tighter text-white whitespace-nowrap">
          PLANET X // SPHEREx
        </span>
      </div>

      {/* Top Controls: Scrambled Telemetry & Filter Pills */}
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-6 sm:flex-row sm:items-center sm:justify-between">
        {/* Scrambled Live Target Readout */}
        <div className="flex items-center space-x-3 text-xs tracking-wider font-mono">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-white font-bold">{scrambledName}</span>
          <span className="text-neutral-600">|</span>
          <span className="text-cyan-400 font-semibold">{scrambledCoords}</span>
          <span className="text-neutral-600 hidden md:inline">|</span>
          <span className="text-amber-400 font-semibold hidden md:inline">
            Δ {activeTarget?.apparentMotion}
          </span>
        </div>

        {/* Category Filters & Blink Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Blink Toggle */}
          <button
            onClick={() => setIsBlinking(!isBlinking)}
            className={`flex items-center space-x-1.5 rounded-full border px-3 py-1 text-xs font-mono transition-colors ${
              isBlinking
                ? 'border-amber-500/40 bg-amber-500/15 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                : 'border-white/10 bg-white/5 text-neutral-400 hover:border-white/20'
            }`}
          >
            <RefreshCw className={`h-3 w-3 ${isBlinking ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
            <span>BLINK: {isBlinking ? `EPOCH 0${blinkEpoch}` : 'OFF'}</span>
          </button>
        </div>
      </div>

      {/* Main Horizon Carousel Track with 3D Cylindrical Horizon Curvature & Shear */}
      <div className="relative my-auto flex items-center justify-center overflow-visible py-8 [perspective:1400px]">
        <div
          className="flex space-x-8 px-12 transition-transform duration-75 will-change-transform"
          style={{
            transform: `translateX(calc(50vw - 190px - ${scrollPosition}px))`,
          }}
        >
          {targets.map((target, idx) => {
            const isSelected = idx === activeIndex
            const cardOffset = scrollPosition - idx * 380
            const innerParallax = -cardOffset * 0.2

            // Cylindrical Horizon Arc Curvature Math
            const normalizedOffset = cardOffset / 380
            const rotateYAngle = Math.max(-25, Math.min(25, -normalizedOffset * 10))
            const translateZOffset = -Math.abs(normalizedOffset) * 45

            // Velocity Shear Skew
            const skewAngle = Math.max(-8, Math.min(8, -renderVelocity * 0.18))

            return (
              <div
                key={target.id}
                onClick={() => handleCardClick(target)}
                className={`group relative h-[410px] w-[340px] shrink-0 overflow-hidden rounded-3xl border transition-all duration-300 will-change-transform ${
                  isSelected
                    ? 'border-amber-500/50 shadow-[0_0_40px_rgba(245,158,11,0.22)] scale-105 z-20'
                    : 'border-white/10 bg-neutral-950/70 opacity-60 hover:opacity-90 hover:border-white/20'
                }`}
                style={{
                  transform: `rotateY(${rotateYAngle}deg) translateZ(${translateZOffset}px) skewX(${skewAngle}deg)`,
                  background: 'linear-gradient(180deg, rgba(14,17,25,0.88) 0%, rgba(5,6,10,0.96) 100%)',
                }}
              >
                {/* Visual Window with Inner Parallax (Aperture effect) */}
                <div className="relative h-[240px] w-full overflow-hidden bg-black">
                  <img
                    src={blinkEpoch === 1 ? target.imageUrlEpoch1 : target.imageUrlEpoch2}
                    alt={target.name}
                    className="absolute inset-0 h-full w-[140%] max-w-none object-cover transition-opacity duration-300 pointer-events-none"
                    style={{
                      transform: `translateX(${innerParallax}px)`,
                      filter: Math.abs(renderVelocity) > 4 ? 'drop-shadow(2px 0 0 rgba(255,0,0,0.6)) drop-shadow(-2px 0 0 rgba(0,255,255,0.6))' : 'none',
                    }}
                  />

                  {/* Gradient Vignette */}
                  <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-black/35 pointer-events-none" />

                  {/* Watermark & Epoch Tag */}
                  <div className="absolute top-3.5 left-3.5 flex items-center space-x-1.5 rounded-lg bg-black/75 backdrop-blur-md px-2.5 py-1 font-mono text-[10px] text-white border border-white/10">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                    <span>SPHEREx EP. {blinkEpoch === 1 ? '2026.1' : '2026.7'}</span>
                  </div>

                  {/* Quick Inspect Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onInspectTarget(target)
                    }}
                    className="absolute top-3.5 right-3.5 flex items-center space-x-1 rounded-lg bg-black/75 backdrop-blur-md px-2 py-1 font-mono text-[10px] text-neutral-300 hover:text-white border border-white/10 hover:border-amber-400/50 transition-colors"
                  >
                    <Maximize2 className="h-3 w-3" />
                    <span>WIPE</span>
                  </button>

                  {/* Motion Detection Reticle */}
                  {isSelected && (
                    <div
                      className="absolute flex items-center justify-center transition-all duration-700 pointer-events-none"
                      style={{
                        top: blinkEpoch === 1 ? '43%' : '49%',
                        left: blinkEpoch === 1 ? '46%' : '54%',
                      }}
                    >
                      <div className="relative h-8 w-8 rounded-full border border-dashed border-amber-400 animate-spin" style={{ animationDuration: '6s' }} />
                      <div className="absolute h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_10px_#f59e0b]" />
                      <span className="absolute -top-5 left-6 whitespace-nowrap font-mono text-[9px] text-amber-300 tracking-wider bg-black/85 px-1.5 py-0.5 rounded border border-amber-400/40 shadow-lg">
                        Δ {target.apparentMotion}
                      </span>
                    </div>
                  )}
                </div>

                {/* Card Info Content */}
                <div className="p-4 flex flex-col justify-between h-[170px]">
                  <div>
                    <div className="flex items-center justify-between font-mono text-[11px]">
                      <span className="text-cyan-400 font-medium tracking-wide">
                        {target.category}
                      </span>
                      <span className="text-neutral-400">
                        DIST: {target.distanceLy}
                      </span>
                    </div>
                    <h3 className="mt-1 text-base font-bold text-white tracking-tight group-hover:text-amber-300 transition-colors">
                      {target.name}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-xs text-neutral-400 leading-relaxed font-sans">
                      {target.description}
                    </p>
                  </div>

                  {/* Card Bottom CTA */}
                  <div className="flex items-center justify-between border-t border-white/5 pt-2">
                    <span className="font-mono text-[10px] text-neutral-400 flex items-center space-x-1">
                      <Sparkles className="h-3 w-3 text-amber-400 inline" />
                      <span>{target.temperatureK}</span>
                    </span>

                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelectTarget(target)
                      }}
                      className="flex items-center space-x-1 font-mono text-xs text-amber-400 hover:text-amber-300 font-semibold group-hover:translate-x-1 transition-transform"
                    >
                      <span>EXPLORE</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Coordinate Ruler / Tick marks (HUD Ruler like in Apsis) */}
      <div className="mx-auto w-full max-w-6xl px-6">
        <div className="relative h-6 w-full border-t border-white/10 flex items-center justify-between text-[9px] font-mono text-neutral-400">
          <span>0.75 µm [OPTICAL/NIR]</span>
          <div className="flex space-x-4 opacity-50">
            {Array.from({ length: 24 }).map((_, i) => (
              <span key={i} className={`h-2 border-l ${i % 4 === 0 ? 'h-3 border-white/40' : 'border-white/15'}`} />
            ))}
          </div>
          <span className="text-amber-400 font-bold">SPHEREx HORIZON DECK // 102 SPECTRAL CHANNELS</span>
          <div className="flex space-x-4 opacity-50">
            {Array.from({ length: 24 }).map((_, i) => (
              <span key={i} className={`h-2 border-l ${i % 4 === 0 ? 'h-3 border-white/40' : 'border-white/15'}`} />
            ))}
          </div>
          <span>5.00 µm [MID-IR/THERMAL]</span>
        </div>
      </div>
    </div>
  )
}
