import React, { useEffect, useRef } from 'react'

export interface StarfieldCanvasProps {
  className?: string
  scrollY?: number
}

interface Star {
  x: number // 0 to 1 normalized horizontal coordinate
  y: number // 0 to 1 normalized vertical coordinate
  size: number // Razor-sharp pixel dimensions (0.9 to 1.8 px)
  baseOpacity: number // Sparse stars varying from 0.2 to 0.9
  speedFactor: number // Subtle vertical scroll parallax depth
  twinkleSpeed: number
  twinklePhase: number
}

export const StarfieldCanvas: React.FC<StarfieldCanvasProps> = ({
  className = '',
  scrollY = 0,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const starsRef = useRef<Star[]>([])
  const scrollYRef = useRef(scrollY)

  useEffect(() => {
    scrollYRef.current = scrollY
  }, [scrollY])

  // Initialize sparse, razor-sharp stars once
  useEffect(() => {
    if (starsRef.current.length > 0) return

    const STAR_COUNT = 220
    const stars: Star[] = []

    for (let i = 0; i < STAR_COUNT; i++) {
      const depthTier = Math.random()
      let size = 1.0
      let baseOpacity = 0.2 + Math.random() * 0.7
      let speedFactor = 0.08

      if (depthTier < 0.6) {
        // Deep background layer (60%): tiny, subtle, slow parallax
        size = 1.0
        baseOpacity = 0.2 + Math.random() * 0.35 // 0.20 to 0.55
        speedFactor = 0.05 + Math.random() * 0.04
      } else if (depthTier < 0.88) {
        // Midground layer (28%): medium brightness
        size = 1.2
        baseOpacity = 0.45 + Math.random() * 0.35 // 0.45 to 0.80
        speedFactor = 0.12 + Math.random() * 0.06
      } else {
        // Foreground accent layer (12%): sharp, prominent
        size = 1.6
        baseOpacity = 0.75 + Math.random() * 0.15 // 0.75 to 0.90
        speedFactor = 0.2 + Math.random() * 0.06
      }

      stars.push({
        x: Math.random(),
        y: Math.random(),
        size,
        baseOpacity,
        speedFactor,
        twinkleSpeed: 0.8 + Math.random() * 1.4,
        twinklePhase: Math.random() * Math.PI * 2,
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

      // Smooth mouse interpolation
      currentMouse.x += (targetMouse.x - currentMouse.x) * 0.05
      currentMouse.y += (targetMouse.y - currentMouse.y) * 0.05

      ctx.save()
      ctx.scale(dpr, dpr)

      // Strict #000000 deep space void
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, width, height)

      // Find real-time screen coordinates of the black hole in Section 1
      let bhX = -9999
      let bhY = -9999
      let hasBlackHole = false

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

      const stars = starsRef.current
      const currentScrollY = scrollYRef.current

      // Gravitational lensing curvature geometry
      const shadowRadius = 86 // Event horizon shadow boundary
      const warpRadius = 380 // Gravitational lensing deflection field extent
      const einsteinRadius = 138 // Characteristic deflection radius

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

        // Subtle scintillation
        if (!prefersReducedMotion) {
          star.twinklePhase += dt * star.twinkleSpeed
          const mod = Math.sin(star.twinklePhase) * 0.08
          alpha = Math.max(0.18, Math.min(0.92, star.baseOpacity + mod))
        }

        // Relativistic space curvature around the black hole
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
