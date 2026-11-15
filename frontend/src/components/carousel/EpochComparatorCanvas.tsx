import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  DEFAULT_TARGET_EPOCH,
  TARGET_EPOCH_DATA,
  type TargetEpochData,
} from './epochData'

export type EpochComparatorMode = 'split' | 'blink' | 'vector'
export type { TargetEpochData }
export { TARGET_EPOCH_DATA, DEFAULT_TARGET_EPOCH }

// Fixed astronomical background star field for absolute reference
interface StaticStar {
  x: number // -1..1 relative to center
  y: number // -1..1 relative to center
  radius: number
  flux: number
  hasDiffraction?: boolean
}

// 64 deterministically seeded stars
const STATIC_STARS: StaticStar[] = [
  { x: -0.78, y: -0.62, radius: 1.4, flux: 0.65 },
  { x: -0.55, y: -0.74, radius: 0.9, flux: 0.4 },
  { x: -0.32, y: -0.82, radius: 1.8, flux: 0.82, hasDiffraction: true },
  { x: -0.15, y: -0.68, radius: 1.1, flux: 0.5 },
  { x: 0.22, y: -0.78, radius: 1.3, flux: 0.6 },
  { x: 0.48, y: -0.85, radius: 0.8, flux: 0.35 },
  { x: 0.72, y: -0.65, radius: 1.5, flux: 0.7 },
  { x: 0.86, y: -0.48, radius: 1.0, flux: 0.45 },
  { x: -0.88, y: -0.38, radius: 1.2, flux: 0.55 },
  { x: -0.68, y: -0.28, radius: 0.9, flux: 0.38 },
  { x: -0.42, y: -0.44, radius: 1.6, flux: 0.75 },
  { x: -0.28, y: -0.18, radius: 1.0, flux: 0.42 },
  { x: 0.18, y: -0.32, radius: 1.4, flux: 0.62 },
  { x: 0.38, y: -0.22, radius: 0.8, flux: 0.3 },
  { x: 0.64, y: -0.36, radius: 1.7, flux: 0.78 },
  { x: 0.82, y: -0.16, radius: 1.1, flux: 0.52 },
  { x: -0.82, y: -0.06, radius: 1.3, flux: 0.58 },
  { x: -0.58, y: 0.08, radius: 0.8, flux: 0.32 },
  { x: -0.46, y: -0.04, radius: 1.5, flux: 0.68 },
  { x: 0.52, y: 0.04, radius: 1.2, flux: 0.5 },
  { x: 0.74, y: 0.12, radius: 0.9, flux: 0.4 },
  { x: 0.88, y: 0.24, radius: 1.6, flux: 0.72 },
  { x: -0.86, y: 0.28, radius: 1.0, flux: 0.46 },
  { x: -0.66, y: 0.36, radius: 1.4, flux: 0.64 },
  { x: -0.38, y: 0.26, radius: 0.8, flux: 0.35 },
  { x: -0.22, y: 0.42, radius: 1.5, flux: 0.7 },
  { x: 0.16, y: 0.38, radius: 1.1, flux: 0.48 },
  { x: 0.36, y: 0.46, radius: 1.3, flux: 0.58 },
  { x: 0.62, y: 0.32, radius: 0.9, flux: 0.36 },
  { x: 0.78, y: 0.48, radius: 1.8, flux: 0.84, hasDiffraction: true },
  { x: -0.74, y: 0.58, radius: 1.2, flux: 0.52 },
  { x: -0.52, y: 0.64, radius: 0.8, flux: 0.34 },
  { x: -0.34, y: 0.72, radius: 1.6, flux: 0.76 },
  { x: -0.12, y: 0.62, radius: 1.0, flux: 0.44 },
  { x: 0.24, y: 0.68, radius: 1.4, flux: 0.66 },
  { x: 0.46, y: 0.76, radius: 0.9, flux: 0.38 },
  { x: 0.68, y: 0.62, radius: 1.3, flux: 0.6 },
  { x: 0.84, y: 0.74, radius: 1.1, flux: 0.48 },
  { x: -0.62, y: -0.86, radius: 1.0, flux: 0.42 },
  { x: 0.08, y: -0.88, radius: 1.3, flux: 0.56 },
  { x: -0.06, y: 0.84, radius: 0.8, flux: 0.3 },
  { x: 0.56, y: 0.86, radius: 1.2, flux: 0.54 },
  { x: -0.76, y: 0.82, radius: 1.1, flux: 0.46 },
  { x: 0.88, y: -0.72, radius: 0.9, flux: 0.38 },
  { x: -0.92, y: 0.04, radius: 1.4, flux: 0.62 },
  { x: 0.92, y: 0.02, radius: 1.0, flux: 0.45 },
  { x: -0.18, y: -0.48, radius: 0.7, flux: 0.28 },
  { x: 0.28, y: -0.12, radius: 0.8, flux: 0.32 },
  { x: -0.26, y: 0.14, radius: 0.7, flux: 0.26 },
  { x: 0.32, y: 0.22, radius: 0.8, flux: 0.3 },
  { x: -0.08, y: 0.28, radius: 0.7, flux: 0.25 },
  { x: 0.06, y: -0.24, radius: 0.8, flux: 0.29 },
  { x: -0.64, y: -0.52, radius: 1.1, flux: 0.48 },
  { x: 0.58, y: -0.58, radius: 1.0, flux: 0.44 },
  { x: -0.48, y: 0.48, radius: 1.2, flux: 0.5 },
  { x: 0.42, y: 0.58, radius: 0.9, flux: 0.37 },
  { x: -0.14, y: -0.34, radius: 0.8, flux: 0.32 },
  { x: 0.12, y: -0.54, radius: 0.9, flux: 0.36 },
  { x: -0.38, y: 0.58, radius: 0.8, flux: 0.31 },
  { x: 0.34, y: 0.38, radius: 0.7, flux: 0.28 },
  { x: -0.04, y: -0.66, radius: 1.0, flux: 0.42 },
  { x: 0.02, y: 0.54, radius: 0.9, flux: 0.38 },
  { x: -0.72, y: 0.18, radius: 0.8, flux: 0.3 },
  { x: 0.68, y: -0.18, radius: 1.1, flux: 0.47 },
]

export interface EpochComparatorCanvasProps {
  targetId?: string
  target?: { id: string; name?: string }
  mode?: EpochComparatorMode
  splitX?: number
  onSplitXChange?: (splitX: number) => void
  onModeChange?: (mode: EpochComparatorMode) => void
  className?: string
  style?: React.CSSProperties
  interactive?: boolean
  showTelemetry?: boolean
  lang?: 'en' | 'ru'
}

// Ease cubic-bezier(0.16, 1, 0.3, 1) approximation for silky target morphing
function easeEditorial(t: number): number {
  const p = Math.max(0, Math.min(1, t))
  // Fast initial velocity with infinite deceleration shelf
  return 1 - Math.pow(1 - p, 3.8)
}

function lerpVal(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export const EpochComparatorCanvas: React.FC<EpochComparatorCanvasProps> = ({
  targetId,
  target,
  mode: controlledMode,
  splitX: controlledSplitX,
  onSplitXChange,
  onModeChange,
  className = '',
  style,
  interactive = true,
  showTelemetry = true,
  lang = 'en',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Internal state for uncontrolled usage
  const [internalMode, setInternalMode] = useState<EpochComparatorMode>('split')
  const [internalSplitX, setInternalSplitX] = useState<number>(0.5)
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const [blinkEpoch, setBlinkEpoch] = useState<'A' | 'B'>('A')

  const mode = controlledMode ?? internalMode
  const splitX = controlledSplitX ?? internalSplitX

  const effectiveTargetId = target?.id ?? targetId ?? 'wise-0855'
  const currentTargetData =
    TARGET_EPOCH_DATA[effectiveTargetId] ?? DEFAULT_TARGET_EPOCH

  // Refs for animation loop
  const targetDataRef = useRef<TargetEpochData>(currentTargetData)
  const prevTargetDataRef = useRef<TargetEpochData>(currentTargetData)
  const transitionStartRef = useRef<number>(0)
  const splitXRef = useRef<number>(splitX)
  const modeRef = useRef<EpochComparatorMode>(mode)
  const isDraggingRef = useRef<boolean>(isDragging)

  useEffect(() => {
    splitXRef.current = splitX
  }, [splitX])

  useEffect(() => {
    modeRef.current = mode
  }, [mode])

  useEffect(() => {
    isDraggingRef.current = isDragging
  }, [isDragging])

  // Morph targets smoothly over 350ms
  useEffect(() => {
    prevTargetDataRef.current = targetDataRef.current
    targetDataRef.current = currentTargetData
    transitionStartRef.current =
      typeof performance !== 'undefined' ? performance.now() : 0
  }, [effectiveTargetId, currentTargetData])

  // 500ms alternation timer for blink mode telemetry
  useEffect(() => {
    if (mode !== 'blink') return
    const timer = setInterval(() => {
      setBlinkEpoch((prev) => (prev === 'A' ? 'B' : 'A'))
    }, 500)
    return () => clearInterval(timer)
  }, [mode])

  const updateSplitX = useCallback(
    (newX: number) => {
      const clamped = Math.max(0.04, Math.min(0.96, newX))
      setInternalSplitX(clamped)
      onSplitXChange?.(clamped)
    },
    [onSplitXChange],
  )

  // Pointer drag interaction for curtain handle
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!interactive || mode !== 'split') return
    const container = containerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    const clickX = (e.clientX - rect.left) / rect.width
    const handlePixelX = rect.width * splitXRef.current

    // Allow grab within 36px of curtain or anywhere on drag
    if (Math.abs(e.clientX - (rect.left + handlePixelX)) < 36) {
      e.currentTarget.setPointerCapture(e.pointerId)
      setIsDragging(true)
      updateSplitX(clickX)
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !interactive || modeRef.current !== 'split')
      return
    const container = containerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    const newX = (e.clientX - rect.left) / rect.width
    updateSplitX(newX)
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingRef.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        // Safe release
      }
      setIsDragging(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      updateSplitX(splitXRef.current - 0.05)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      updateSplitX(splitXRef.current + 0.05)
    } else if (e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault()
      const nextMode: EpochComparatorMode =
        modeRef.current === 'blink' ? 'split' : 'blink'
      setInternalMode(nextMode)
      onModeChange?.(nextMode)
    }
  }

  // 60 FPS Canvas Renderer
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return

    let width = 0
    let height = 0
    let dpr = 1
    let animationFrameId = 0

    const updateDimensions = () => {
      const parent = canvas.parentElement
      if (!parent) return

      const rect = parent.getBoundingClientRect()
      width = Math.max(1, Math.floor(rect.width))
      height = Math.max(1, Math.floor(rect.height))
      dpr = Math.min(window.devicePixelRatio || 1, 2)

      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
    }

    updateDimensions()
    let resizeObserver: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined' && canvas.parentElement) {
      resizeObserver = new ResizeObserver(updateDimensions)
      resizeObserver.observe(canvas.parentElement)
    }
    window.addEventListener('resize', updateDimensions)

    // Render loop
    const render = (now: number) => {
      if (width === 0 || height === 0) {
        animationFrameId = window.requestAnimationFrame(render)
        return
      }

      const currentMode = modeRef.current
      const currentSplitX = splitXRef.current
      const targetData = targetDataRef.current
      const prevTargetData = prevTargetDataRef.current

      // Target transition factor (0..1 over 350ms)
      const startT = transitionStartRef.current || now
      const elapsed = now - startT
      const transitionT = easeEditorial(Math.min(1, elapsed / 350))

      // Interpolated target properties
      const morphTarget = (epoch: 'epochA' | 'epochB') => {
        const p = prevTargetData[epoch]
        const n = targetData[epoch]
        return {
          dx: lerpVal(p.dx, n.dx, transitionT),
          dy: lerpVal(p.dy, n.dy, transitionT),
          radius: lerpVal(p.radius, n.radius, transitionT),
          flux: lerpVal(p.flux, n.flux, transitionT),
          diffractionSpikes:
            transitionT > 0.5 ? n.diffractionSpikes : p.diffractionSpikes,
          hasCompanion: transitionT > 0.5 ? n.hasCompanion : p.hasCompanion,
          companionOffset: n.companionOffset,
          coronaRadius: lerpVal(
            p.coronaRadius || 0,
            n.coronaRadius || 0,
            transitionT,
          ),
          catalog: n.catalog,
          year: n.year,
        }
      }

      const epochA = morphTarget('epochA')
      const epochB = morphTarget('epochB')

      ctx.save()
      ctx.scale(dpr, dpr)

      // 1. Deep Space Void (#000000)
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, width, height)

      const cx = width / 2
      const cy = height / 2

      // 2. Faint Astronomical 1px Coordinate Grid
      const gridSize = 64
      ctx.lineWidth = 1
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'
      ctx.beginPath()

      const offsetX = cx % gridSize
      for (let x = offsetX; x < width; x += gridSize) {
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
      }

      const offsetY = cy % gridSize
      for (let y = offsetY; y < height; y += gridSize) {
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
      }
      ctx.stroke()

      // Center Field Reticle Crosshair (+)
      const reticleSpan = 12
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)'
      ctx.beginPath()
      ctx.moveTo(cx - reticleSpan, cy)
      ctx.lineTo(cx + reticleSpan, cy)
      ctx.moveTo(cx, cy - reticleSpan)
      ctx.lineTo(cx, cy + reticleSpan)
      ctx.stroke()

      // Precision Perimeter Border Ticks
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
      ctx.beginPath()
      for (let x = offsetX; x < width; x += gridSize) {
        ctx.moveTo(x, 0)
        ctx.lineTo(x, 5)
        ctx.moveTo(x, height)
        ctx.lineTo(x, height - 5)
      }
      for (let y = offsetY; y < height; y += gridSize) {
        ctx.moveTo(0, y)
        ctx.lineTo(5, y)
        ctx.moveTo(width, y)
        ctx.lineTo(width - 5, y)
      }
      ctx.stroke()

      // 3. Static High-Contrast Field Stars
      const fieldSpanX = width * 0.44
      const fieldSpanY = height * 0.44

      for (let i = 0; i < STATIC_STARS.length; i++) {
        const star = STATIC_STARS[i]
        const sx = cx + star.x * fieldSpanX
        const sy = cy + star.y * fieldSpanY

        ctx.fillStyle = `rgba(255, 255, 255, ${star.flux.toFixed(3)})`
        const halfSize = star.radius / 2
        ctx.fillRect(
          Math.round(sx - halfSize),
          Math.round(sy - halfSize),
          star.radius,
          star.radius,
        )

        // Subtle diffraction spikes on primary guide star
        if (star.hasDiffraction) {
          ctx.strokeStyle = `rgba(255, 255, 255, ${(star.flux * 0.35).toFixed(3)})`
          ctx.beginPath()
          ctx.moveTo(sx - 8, sy)
          ctx.lineTo(sx + 8, sy)
          ctx.moveTo(sx, sy - 8)
          ctx.lineTo(sx, sy + 8)
          ctx.stroke()
        }
      }

      // Draw Star Target Helper Function
      const renderStarTarget = (
        tx: number,
        ty: number,
        radius: number,
        flux: number,
        corona: number,
        hasSpikes?: boolean,
        label?: string,
        reticleColor = 'rgba(255, 255, 255, 0.45)',
      ) => {
        // Soft Luminous Corona Glow
        if (corona > 0) {
          const grad = ctx.createRadialGradient(tx, ty, 0, tx, ty, corona)
          grad.addColorStop(0, `rgba(255, 255, 255, ${(0.32 * flux).toFixed(3)})`)
          grad.addColorStop(0.5, `rgba(215, 225, 240, ${(0.1 * flux).toFixed(3)})`)
          grad.addColorStop(1, 'rgba(0, 0, 0, 0)')
          ctx.fillStyle = grad
          ctx.beginPath()
          ctx.arc(tx, ty, corona, 0, Math.PI * 2)
          ctx.fill()
        }

        // Razor-sharp Central Core
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, flux).toFixed(3)})`
        ctx.beginPath()
        ctx.arc(tx, ty, radius, 0, Math.PI * 2)
        ctx.fill()

        // Diffraction Spikes for high-flux sources
        if (hasSpikes) {
          const spikeLen = Math.max(16, radius * 3.6)
          ctx.strokeStyle = `rgba(255, 255, 255, ${(0.45 * flux).toFixed(3)})`
          ctx.beginPath()
          ctx.moveTo(tx - spikeLen, ty)
          ctx.lineTo(tx + spikeLen, ty)
          ctx.moveTo(tx, ty - spikeLen)
          ctx.lineTo(tx, ty + spikeLen)
          ctx.stroke()
        }

        // Astronomical Reticle Indicator (+)
        const retSize = 14
        const retGap = radius + 3
        ctx.strokeStyle = reticleColor
        ctx.lineWidth = 1
        ctx.beginPath()
        // Left
        ctx.moveTo(tx - retSize, ty)
        ctx.lineTo(tx - retGap, ty)
        // Right
        ctx.moveTo(tx + retGap, ty)
        ctx.lineTo(tx + retSize, ty)
        // Top
        ctx.moveTo(tx, ty - retSize)
        ctx.lineTo(tx, ty - retGap)
        // Bottom
        ctx.moveTo(tx, ty + retGap)
        ctx.lineTo(tx, ty + retSize)
        ctx.stroke()

        // Label Marker
        if (label) {
          ctx.font = '9px monospace'
          ctx.fillStyle = 'rgba(255, 255, 255, 0.75)'
          ctx.fillText(label, tx + retSize + 4, ty + 3)
        }
      }

      // 4. Target Rendering According to Active Mode
      const targetAx = cx + epochA.dx
      const targetAy = cy + epochA.dy
      const targetBx = cx + epochB.dx
      const targetBy = cy + epochB.dy

      if (currentMode === 'split') {
        const splitPx = Math.floor(width * currentSplitX)

        // Epoch A Left Clip Region
        ctx.save()
        ctx.beginPath()
        ctx.rect(0, 0, splitPx, height)
        ctx.clip()

        renderStarTarget(
          targetAx,
          targetAy,
          epochA.radius,
          epochA.flux,
          epochA.coronaRadius,
          epochA.diffractionSpikes,
          'A',
        )

        if (epochA.hasCompanion && epochA.companionOffset) {
          renderStarTarget(
            cx + epochA.companionOffset.dx,
            cy + epochA.companionOffset.dy,
            epochA.companionOffset.radius,
            epochA.companionOffset.flux,
            6,
            false,
            'Bb',
          )
        }
        ctx.restore()

        // Epoch B Right Clip Region
        ctx.save()
        ctx.beginPath()
        ctx.rect(splitPx, 0, width - splitPx, height)
        ctx.clip()

        renderStarTarget(
          targetBx,
          targetBy,
          epochB.radius,
          epochB.flux,
          epochB.coronaRadius,
          epochB.diffractionSpikes,
          'B',
        )

        if (epochB.hasCompanion && epochB.companionOffset) {
          renderStarTarget(
            cx + epochB.companionOffset.dx,
            cy + epochB.companionOffset.dy,
            epochB.companionOffset.radius,
            epochB.companionOffset.flux,
            6,
            false,
            'Bb',
          )
        }
        ctx.restore()

        // 1px Solid #FFFFFF Split Curtain Line
        ctx.strokeStyle = '#FFFFFF'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(splitPx + 0.5, 0)
        ctx.lineTo(splitPx + 0.5, height)
        ctx.stroke()

        // Center Pill Drag Handle (< >)
        const pillW = 26
        const pillH = 44
        const pillX = splitPx - pillW / 2
        const pillY = cy - pillH / 2
        const pillRadius = 13

        // Pill background
        ctx.fillStyle = isDraggingRef.current ? '#FFFFFF' : '#000000'
        ctx.strokeStyle = '#FFFFFF'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.roundRect(pillX, pillY, pillW, pillH, pillRadius)
        ctx.fill()
        ctx.stroke()

        // Pill Glyphs (< >)
        ctx.fillStyle = isDraggingRef.current ? '#000000' : '#FFFFFF'
        ctx.font = '10px monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('‹ ›', splitPx, cy)
      } else if (currentMode === 'blink') {
        // Rapid 500ms Alternating Frame Interval
        const isEpochA = now % 1000 < 500

        if (isEpochA) {
          renderStarTarget(
            targetAx,
            targetAy,
            epochA.radius,
            epochA.flux,
            epochA.coronaRadius,
            epochA.diffractionSpikes,
            'EPOCH A',
          )

          if (epochA.hasCompanion && epochA.companionOffset) {
            renderStarTarget(
              cx + epochA.companionOffset.dx,
              cy + epochA.companionOffset.dy,
              epochA.companionOffset.radius,
              epochA.companionOffset.flux,
              6,
              false,
              'Bb',
            )
          }
        } else {
          renderStarTarget(
            targetBx,
            targetBy,
            epochB.radius,
            epochB.flux,
            epochB.coronaRadius,
            epochB.diffractionSpikes,
            'EPOCH B',
          )

          if (epochB.hasCompanion && epochB.companionOffset) {
            renderStarTarget(
              cx + epochB.companionOffset.dx,
              cy + epochB.companionOffset.dy,
              epochB.companionOffset.radius,
              epochB.companionOffset.flux,
              6,
              false,
              'Bb',
            )
          }
        }
      } else if (currentMode === 'vector') {
        // Mode 3: VECTOR Display showing both positions + 1px dashed displacement vector
        renderStarTarget(
          targetAx,
          targetAy,
          epochA.radius,
          epochA.flux * 0.7,
          epochA.coronaRadius,
          epochA.diffractionSpikes,
          'A',
          'rgba(255, 255, 255, 0.4)',
        )

        renderStarTarget(
          targetBx,
          targetBy,
          epochB.radius,
          epochB.flux,
          epochB.coronaRadius,
          epochB.diffractionSpikes,
          'B',
          '#FFFFFF',
        )

        // 1px Dashed Displacement Vector Line
        ctx.strokeStyle = '#FFFFFF'
        ctx.lineWidth = 1
        ctx.setLineDash([4, 4])
        ctx.beginPath()
        ctx.moveTo(targetAx, targetAy)
        ctx.lineTo(targetBx, targetBy)
        ctx.stroke()
        ctx.setLineDash([]) // Reset line dash

        // Vector Directional Arrow Head at Endpoint B
        const angle = Math.atan2(targetBy - targetAy, targetBx - targetAx)
        const arrowDist = Math.hypot(targetBx - targetAx, targetBy - targetAy)

        if (arrowDist > 14) {
          const arrowLength = 7
          const arrowAngle = Math.PI / 6
          const tipX = targetBx - Math.cos(angle) * (epochB.radius + 3)
          const tipY = targetBy - Math.sin(angle) * (epochB.radius + 3)

          ctx.fillStyle = '#FFFFFF'
          ctx.beginPath()
          ctx.moveTo(tipX, tipY)
          ctx.lineTo(
            tipX - arrowLength * Math.cos(angle - arrowAngle),
            tipY - arrowLength * Math.sin(angle - arrowAngle),
          )
          ctx.lineTo(
            tipX - arrowLength * Math.cos(angle + arrowAngle),
            tipY - arrowLength * Math.sin(angle + arrowAngle),
          )
          ctx.closePath()
          ctx.fill()

          // Midpoint Vector Telemetry
          const midX = (targetAx + targetBx) / 2
          const midY = (targetAy + targetBy) / 2
          ctx.font = '9px monospace'
          ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'bottom'
          ctx.fillText(`Δθ = ${targetData.angularShift}`, midX, midY - 6)
        }
      }

      ctx.restore()
      animationFrameId = window.requestAnimationFrame(render)
    }

    animationFrameId = window.requestAnimationFrame(render)

    return () => {
      window.cancelAnimationFrame(animationFrameId)
      if (resizeObserver) {
        resizeObserver.disconnect()
      }
      window.removeEventListener('resize', updateDimensions)
    }
  }, [])

  const isBlinkActive = mode === 'blink'

  return (
    <div
      ref={containerRef}
      className={`epoch-comparator-stage-wrap ${className}`}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: '380px',
        background: '#000000',
        overflow: 'hidden',
        userSelect: 'none',
        touchAction: 'none',
        cursor:
          mode === 'split' ? (isDragging ? 'ew-resize' : 'default') : 'default',
        ...style,
      }}
      tabIndex={0}
      role="region"
      aria-label="Astronomical epoch comparator"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="epoch-comparator-canvas"
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
        }}
      />

      {/* Viewport Corner Telemetry Labels */}
      {showTelemetry && (
        <>
          {/* Top-Left: EPOCH A / ARCHIVE */}
          <div
            className="epoch-corner-tag tag-top-left"
            style={{
              position: 'absolute',
              top: '14px',
              left: '16px',
              pointerEvents: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              opacity: isBlinkActive && blinkEpoch !== 'A' ? 0.35 : 1,
              transition: 'opacity 0.15s ease',
            }}
          >
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '1px',
                color: '#FFFFFF',
              }}
            >
              EPOCH A / ARCHIVE
            </span>
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: '9px',
                letterSpacing: '0.5px',
                color: 'rgba(255, 255, 255, 0.55)',
              }}
            >
              {currentTargetData.epochA.catalog} [{currentTargetData.epochA.year}]
            </span>
          </div>

          {/* Top-Right: EPOCH B / SPHEREx */}
          <div
            className="epoch-corner-tag tag-top-right"
            style={{
              position: 'absolute',
              top: '14px',
              right: '16px',
              pointerEvents: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: '2px',
              opacity: isBlinkActive && blinkEpoch !== 'B' ? 0.35 : 1,
              transition: 'opacity 0.15s ease',
            }}
          >
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '1px',
                color: '#FFFFFF',
              }}
            >
              EPOCH B / SPHEREx
            </span>
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: '9px',
                letterSpacing: '0.5px',
                color: 'rgba(255, 255, 255, 0.55)',
              }}
            >
              {currentTargetData.epochB.catalog} [{currentTargetData.epochB.year}]
            </span>
          </div>

          {/* Bottom-Left: Target Name & Notes */}
          <div
            className="epoch-corner-tag tag-bottom-left"
            style={{
              position: 'absolute',
              bottom: '14px',
              left: '16px',
              pointerEvents: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              maxWidth: '380px',
            }}
          >
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: '10px',
                fontWeight: 500,
                color: '#FFFFFF',
                letterSpacing: '0.5px',
              }}
            >
              {currentTargetData.name}
            </span>
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: '9px',
                color: 'rgba(255, 255, 255, 0.5)',
                lineHeight: '1.2',
              }}
            >
              {lang === 'ru'
                ? currentTargetData.notesRu
                : currentTargetData.notesEn}
            </span>
          </div>

          {/* Bottom-Right: Astrometry FOV scale */}
          <div
            className="epoch-corner-tag tag-bottom-right"
            style={{
              position: 'absolute',
              bottom: '14px',
              right: '16px',
              pointerEvents: 'none',
              textAlign: 'right',
            }}
          >
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: '9px',
                letterSpacing: '0.5px',
                color: 'rgba(255, 255, 255, 0.45)',
              }}
            >
              FOV: 45" × 45" | 1px ≈ 0.088"
            </span>
          </div>
        </>
      )}
    </div>
  )
}

export default EpochComparatorCanvas
