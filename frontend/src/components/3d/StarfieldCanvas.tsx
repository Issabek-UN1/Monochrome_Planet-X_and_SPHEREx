import React, { useEffect, useRef } from 'react'
import type { Mode } from '../layout/modes'

export interface StarfieldCanvasProps {
  className?: string
  scrollY?: number
  mode?: Mode | string
}

interface Star {
  x: number // 0 to 1 normalized horizontal coordinate
  y: number // 0 to 1 normalized vertical coordinate
  size: number // Razor-sharp pixel dimensions (0.8 to 2.2 px)
  baseOpacity: number // Sparse stars varying from 0.18 to 0.95
  speedFactor: number // Subtle vertical scroll parallax depth
  twinkleSpeed: number
  twinklePhase: number
  hasDiffraction?: boolean // Subtle 4-point crosshair diffraction spike for bright stars
}

interface NebulaCloud {
  relX: number // 0..1 normalized position
  relY: number // 0..1
  radius: number // radial extent in pixels
  scaleX: number // elliptical stretch
  scaleY: number
  angle: number // orientation tilt in radians
  baseAlpha: number // subtle monochrome opacity (0.018 to 0.055)
  driftSpeed: number // slow organic drift rate
  driftPhase: number
}

// 8 deterministic interstellar molecular dust & gas clouds
const NEBULA_CLOUDS: NebulaCloud[] = [
  // Upper-left celestial filament
  {
    relX: 0.18,
    relY: 0.22,
    radius: 380,
    scaleX: 1.8,
    scaleY: 0.85,
    angle: 0.42,
    baseAlpha: 0.042,
    driftSpeed: 0.35,
    driftPhase: 0.0,
  },
  // Deep-space diffuse molecular cloud (center-left)
  {
    relX: 0.32,
    relY: 0.58,
    radius: 460,
    scaleX: 1.5,
    scaleY: 1.1,
    angle: -0.28,
    baseAlpha: 0.038,
    driftSpeed: 0.28,
    driftPhase: 1.4,
  },
  // Center-right high-latitude galactic dust lane
  {
    relX: 0.72,
    relY: 0.36,
    radius: 420,
    scaleX: 2.1,
    scaleY: 0.75,
    angle: -0.55,
    baseAlpha: 0.048,
    driftSpeed: 0.32,
    driftPhase: 2.8,
  },
  // Lower-right subtle emission veil
  {
    relX: 0.84,
    relY: 0.76,
    radius: 340,
    scaleX: 1.4,
    scaleY: 0.95,
    angle: 0.36,
    baseAlpha: 0.035,
    driftSpeed: 0.42,
    driftPhase: 4.1,
  },
  // Upper-right cosmic dust tendril
  {
    relX: 0.88,
    relY: 0.16,
    radius: 300,
    scaleX: 1.6,
    scaleY: 0.7,
    angle: 0.62,
    baseAlpha: 0.032,
    driftSpeed: 0.25,
    driftPhase: 5.2,
  },
  // Lower-left deep infrared veil
  {
    relX: 0.12,
    relY: 0.82,
    radius: 360,
    scaleX: 1.7,
    scaleY: 0.9,
    angle: -0.44,
    baseAlpha: 0.036,
    driftSpeed: 0.38,
    driftPhase: 3.5,
  },
  // Central subtle interstellar mist
  {
    relX: 0.52,
    relY: 0.48,
    radius: 520,
    scaleX: 1.3,
    scaleY: 1.2,
    angle: 0.15,
    baseAlpha: 0.026,
    driftSpeed: 0.22,
    driftPhase: 0.8,
  },
  // Transverse filament connecting east-west
  {
    relX: 0.46,
    relY: 0.26,
    radius: 390,
    scaleX: 2.4,
    scaleY: 0.6,
    angle: 0.32,
    baseAlpha: 0.034,
    driftSpeed: 0.3,
    driftPhase: 2.1,
  },
]

export const StarfieldCanvas: React.FC<StarfieldCanvasProps> = ({
  className = '',
  scrollY = 0,
  mode = 'vault',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const starsRef = useRef<Star[]>([])
  const scrollYRef = useRef(scrollY)
  const modeRef = useRef(mode)

  useEffect(() => {
    scrollYRef.current = scrollY
  }, [scrollY])

  useEffect(() => {
    modeRef.current = mode
  }, [mode])

  // Initialize dense astronomical starfield (360 stars partitioned into 3 FITS depth tiers)
  useEffect(() => {
    if (starsRef.current.length > 0) return

    const STAR_COUNT = 360
    const stars: Star[] = []

    for (let i = 0; i < STAR_COUNT; i++) {
      const depthTier = Math.random()
      let size = 0.9
      let baseOpacity = 0.18 + Math.random() * 0.35
      let speedFactor = 0.05 + Math.random() * 0.04
      let hasDiffraction = false

      if (depthTier < 0.65) {
        // Deep background star dust (65%): pinpoint, dense, slow parallax
        size = 0.85 + Math.random() * 0.3 // 0.85 to 1.15 px
        baseOpacity = 0.18 + Math.random() * 0.32 // 0.18 to 0.50
        speedFactor = 0.04 + Math.random() * 0.04
      } else if (depthTier < 0.91) {
        // Midground stars (26%): crisp, medium brightness
        size = 1.2 + Math.random() * 0.3 // 1.2 to 1.5 px
        baseOpacity = 0.45 + Math.random() * 0.35 // 0.45 to 0.80
        speedFactor = 0.1 + Math.random() * 0.06
      } else {
        // Foreground guide stars (9%): prominent high-contrast FITS stars
        size = 1.6 + Math.random() * 0.6 // 1.6 to 2.2 px
        baseOpacity = 0.78 + Math.random() * 0.2 // 0.78 to 0.98
        speedFactor = 0.18 + Math.random() * 0.07
        // Approximately half of foreground guide stars have subtle crosshair diffraction spikes
        hasDiffraction = Math.random() < 0.55
      }

      stars.push({
        x: Math.random(),
        y: Math.random(),
        size,
        baseOpacity,
        speedFactor,
        twinkleSpeed: 0.6 + Math.random() * 1.5,
        twinklePhase: Math.random() * Math.PI * 2,
        hasDiffraction,
      })
    }

    starsRef.current = stars
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches

    let width = 0
    let height = 0
    let dpr = 1
    let animationFrameId = 0
    let lastTime = performance.now()

    // Mouse parallax tracking
    const targetMouse = { x: 0, y: 0 }
    const currentMouse = { x: 0, y: 0 }

    const updateDimensions = () => {
      width = Math.max(1, Math.floor(window.innerWidth))
      height = Math.max(1, Math.floor(window.innerHeight))
      dpr = Math.min(window.devicePixelRatio || 1, 2)

      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)

    const handlePointerMove = (e: PointerEvent) => {
      if (width === 0 || height === 0) return
      const nx = (e.clientX / width) * 2 - 1
      const ny = (e.clientY / height) * 2 - 1
      targetMouse.x = Math.max(-1, Math.min(1, nx))
      targetMouse.y = Math.max(-1, Math.min(1, ny))
    }

    const handlePointerLeave = () => {
      targetMouse.x = 0
      targetMouse.y = 0
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    document.addEventListener('mouseleave', handlePointerLeave)

    const render = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.1)
      lastTime = now

      if (width === 0 || height === 0) {
        animationFrameId = window.requestAnimationFrame(render)
        return
      }

      // Smooth mouse interpolation (inertia factor 0.05)
      currentMouse.x += (targetMouse.x - currentMouse.x) * 0.05
      currentMouse.y += (targetMouse.y - currentMouse.y) * 0.05

      const currentMode = modeRef.current
      const currentScrollY = scrollYRef.current

      ctx.save()
      ctx.scale(dpr, dpr)

      // 1. Strict #000000 deep space void
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, width, height)

      // 2. Procedural Monochrome Cosmic Nebula ("Туманность")
      // Soft, organic molecular gas & dust clouds with layered radial gradients
      const timeSec = now * 0.001
      const motionMult = prefersReducedMotion ? 0.15 : 1.0

      ctx.save()
      // Use screen blend mode for organic, luminous cosmic cloud accumulation
      ctx.globalCompositeOperation = 'screen'

      for (let i = 0; i < NEBULA_CLOUDS.length; i++) {
        const cloud = NEBULA_CLOUDS[i]

        // Slow harmonic breathing / drift over time
        const breath =
          Math.sin(timeSec * cloud.driftSpeed * 0.4 * motionMult + cloud.driftPhase) *
          0.12
        const effectiveAlpha = Math.max(
          0.008,
          Math.min(0.065, cloud.baseAlpha * (1 + breath)),
        )

        // Parallax drift with mouse and scroll
        const driftX =
          Math.cos(timeSec * cloud.driftSpeed * 0.25 * motionMult + cloud.driftPhase) *
          18
        const driftY =
          Math.sin(timeSec * cloud.driftSpeed * 0.25 * motionMult + cloud.driftPhase) *
          14

        const baseX = cloud.relX * width + currentMouse.x * 20 + driftX
        const rawY =
          cloud.relY * height - currentScrollY * 0.05 + currentMouse.y * 14 + driftY
        const baseY = ((rawY % height) + height) % height

        const r = cloud.radius * (width < 768 ? 0.75 : 1)

        ctx.save()
        ctx.translate(baseX, baseY)
        ctx.rotate(cloud.angle)
        ctx.scale(cloud.scaleX, cloud.scaleY)

        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r)
        grad.addColorStop(
          0,
          `rgba(245, 248, 255, ${effectiveAlpha.toFixed(4)})`,
        )
        grad.addColorStop(
          0.38,
          `rgba(220, 230, 248, ${(effectiveAlpha * 0.55).toFixed(4)})`,
        )
        grad.addColorStop(
          0.72,
          `rgba(180, 200, 225, ${(effectiveAlpha * 0.18).toFixed(4)})`,
        )
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)')

        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(0, 0, r, 0, Math.PI * 2)
        ctx.fill()

        ctx.restore()
      }
      ctx.restore() // End screen composite

      // 3. Black Hole Screen Position for Gravitational Lensing (Mode: 'vault')
      let bhX = -9999
      let bhY = -9999
      let hasBlackHole = false

      if (currentMode === 'vault') {
        const vaultWindow = document.querySelector('.vault-window')
        if (vaultWindow) {
          const rect = vaultWindow.getBoundingClientRect()
          // Only compute warp if the black hole horizon is near or inside viewport
          if (rect.bottom > -150 && rect.top < height + 150) {
            hasBlackHole = true
            const isCompact = rect.width < 920
            const baseHorizonX = isCompact ? rect.width * 0.56 : rect.width * 0.64
            const baseHorizonY = isCompact ? rect.height * 0.38 : rect.height * 0.44

            const parallaxX = currentMouse.x * 22
            const parallaxY = currentMouse.y * 14

            bhX = rect.left + baseHorizonX + parallaxX
            bhY = rect.top + baseHorizonY + parallaxY
          }
        }
      }

      // Gravitational lensing curvature geometry
      const shadowRadius = 86 // Event horizon shadow boundary
      const warpRadius = 380 // Gravitational lensing deflection field extent
      const einsteinRadius = 138 // Characteristic deflection radius

      // 4. Starfield Rendering
      const stars = starsRef.current

      for (let i = 0; i < stars.length; i++) {
        const star = stars[i]

        // Vertical scroll parallax with continuous modulo wrapping
        const rawY = star.y * height - currentScrollY * star.speedFactor
        const wrappedY = ((rawY % height) + height) % height
        const baseX = star.x * width
        const baseY = wrappedY

        let renderX = baseX
        let renderY = baseY
        let alpha = star.baseOpacity

        // Delicate scintillation / twinkle
        if (!prefersReducedMotion) {
          star.twinklePhase += dt * star.twinkleSpeed
          const mod = Math.sin(star.twinklePhase) * 0.08
          alpha = Math.max(0.15, Math.min(0.98, star.baseOpacity + mod))
        }

        // Relativistic space curvature around black hole (when in vault mode)
        if (hasBlackHole) {
          const dx = baseX - bhX
          const dy = baseY - bhY
          const dist = Math.hypot(dx, dy)

          if (dist < shadowRadius) {
            // Star is occluded behind the event horizon shadow
            continue
          }

          if (dist < warpRadius) {
            // Einsteinian radial deflection curving space around the gravity well
            const falloff = 1 - (dist - shadowRadius) / (warpRadius - shadowRadius)
            const deflection = (einsteinRadius * einsteinRadius) / (dist + 36)
            const radialPush = deflection * falloff

            const angle = Math.atan2(dy, dx)
            // Relativistic frame dragging swirl along horizon tangent
            const swirl = 0.16 * Math.pow(falloff, 1.8)
            const warpedAngle = angle + swirl

            renderX = bhX + Math.cos(warpedAngle) * (dist + radialPush)
            renderY = bhY + Math.sin(warpedAngle) * (dist + radialPush)

            // Gravitational lensing magnification
            const magnification = 1 + 0.35 * Math.pow(falloff, 2)
            alpha = Math.min(1, alpha * magnification)
          }
        }

        // Razor-sharp #FFFFFF star rendering without subpixel blurring
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha.toFixed(3)})`
        const halfSize = star.size / 2
        ctx.fillRect(
          Math.round(renderX - halfSize),
          Math.round(renderY - halfSize),
          star.size,
          star.size,
        )

        // Subtle 4-point crosshair diffraction spikes for prominent foreground stars
        if (star.hasDiffraction && alpha > 0.65) {
          const spikeLen = Math.round(star.size * 3.5 + 3)
          ctx.strokeStyle = `rgba(255, 255, 255, ${(alpha * 0.32).toFixed(3)})`
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(renderX - spikeLen, renderY)
          ctx.lineTo(renderX + spikeLen, renderY)
          ctx.moveTo(renderX, renderY - spikeLen)
          ctx.lineTo(renderX, renderY + spikeLen)
          ctx.stroke()
        }
      }

      ctx.restore()
      animationFrameId = window.requestAnimationFrame(render)
    }

    animationFrameId = window.requestAnimationFrame(render)

    return () => {
      window.cancelAnimationFrame(animationFrameId)
      window.removeEventListener('resize', updateDimensions)
      window.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('mouseleave', handlePointerLeave)
    }
  }, [])

  return (
    <div
      className={`starfield-container ${className}`}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: '#000000',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="starfield-canvas"
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
        }}
      />
    </div>
  )
}

export default StarfieldCanvas
