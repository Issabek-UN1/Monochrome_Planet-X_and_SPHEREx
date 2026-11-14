import React, { useEffect, useRef, useState } from 'react'

export const TargetingCursor: React.FC = () => {
  const cursorRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState({ ra: '180.00', dec: '+00.00' })
  const [isHoveringInteractive, setIsHoveringInteractive] = useState(false)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Check if touch device
    if (window.matchMedia('(pointer: coarse)').matches) {
      return
    }

    let mouseX = window.innerWidth / 2
    let mouseY = window.innerHeight / 2
    let ringX = mouseX
    let ringY = mouseY
    let animationFrameId: number

    const handleMouseMove = (e: MouseEvent) => {
      setIsVisible(true)
      mouseX = e.clientX
      mouseY = e.clientY

      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0)`
      }

      // Calculate celestial coordinates from screen position
      const raVal = ((mouseX / window.innerWidth) * 360).toFixed(2)
      const decVal = (90 - (mouseY / window.innerHeight) * 180).toFixed(2)
      setCoords({
        ra: raVal,
        dec: Number(decVal) >= 0 ? `+${decVal}` : decVal,
      })

      // Check if target or parent is interactive
      const target = e.target as HTMLElement | null
      const isInteractive = Boolean(
        target?.closest('button, a, input, select, [role="button"], .cursor-pointer')
      )
      setIsHoveringInteractive(isInteractive)
    }

    const handleMouseLeave = () => {
      setIsVisible(false)
    }

    const updateRingPhysics = () => {
      // Lerp for trailing ring
      ringX += (mouseX - ringX) * 0.16
      ringY += (mouseY - ringY) * 0.16

      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${ringX}px, ${ringY}px, 0)`
      }

      animationFrameId = requestAnimationFrame(updateRingPhysics)
    }

    window.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseleave', handleMouseLeave)
    animationFrameId = requestAnimationFrame(updateRingPhysics)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseleave', handleMouseLeave)
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  if (!isVisible) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-[100] overflow-hidden">
      {/* Central Crosshair Dot */}
      <div
        ref={cursorRef}
        className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 will-change-transform"
      >
        <div
          className={`h-1.5 w-1.5 rounded-full transition-colors duration-150 ${
            isHoveringInteractive ? 'bg-amber-400 shadow-[0_0_8px_#f59e0b]' : 'bg-cyan-400'
          }`}
        />
      </div>

      {/* Trailing Orbital Reticle */}
      <div
        ref={ringRef}
        className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 will-change-transform"
      >
        <div
          className={`relative rounded-full border transition-all duration-200 ${
            isHoveringInteractive
              ? 'h-10 w-10 border-amber-400/80 bg-amber-400/10 scale-125'
              : 'h-6 w-6 border-white/20'
          }`}
        >
          {/* Subtle tick crosshairs */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 h-1 w-0.5 bg-white/40" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1 h-1 w-0.5 bg-white/40" />
          <div className="absolute top-1/2 left-0 -translate-y-1/2 -translate-x-1 w-1 h-0.5 bg-white/40" />
          <div className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-1 w-1 h-0.5 bg-white/40" />
        </div>

        {/* Small live coordinate HUD next to cursor */}
        <div className="absolute top-4 left-4 whitespace-nowrap rounded bg-black/80 backdrop-blur-md px-1.5 py-0.5 font-mono text-[9px] text-neutral-400 border border-white/10 opacity-75">
          <span>{coords.ra}° / {coords.dec}°</span>
        </div>
      </div>
    </div>
  )
}
