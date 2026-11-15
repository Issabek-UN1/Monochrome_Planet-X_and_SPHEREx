import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { CURATED_TARGETS, type EnhancedTarget } from '../../api/client'
import { playTone } from '../../utils/audio'

interface Props {
  targetRa?: number
  targetDec?: number
  className?: string
  target?: EnhancedTarget
  onSelect?: (target: EnhancedTarget) => void
  semiMajor?: number
  inclination?: number
  animated?: boolean
}

// Target-specific orbital signatures to demonstrate dynamic orbit morphing
const TARGET_ORBIT_CONFIG: Record<
  string,
  { inclination: number; eccentricity: number; semiMajor: number }
> = {
  'wise-0855': { inclination: 30, eccentricity: 0.65, semiMajor: 600 },
  'barnards-star': { inclination: 18, eccentricity: 0.35, semiMajor: 520 },
  'epsilon-indi-b': { inclination: 42, eccentricity: 0.58, semiMajor: 680 },
  'rw-aurigae': { inclination: 55, eccentricity: 0.72, semiMajor: 750 },
  'r-draconis': { inclination: 68, eccentricity: 0.22, semiMajor: 480 },
}

function vector(ra: number, dec: number, radius = 2.8) {
  const alpha = THREE.MathUtils.degToRad(ra),
    delta = THREE.MathUtils.degToRad(dec)
  return new THREE.Vector3(
    radius * Math.cos(delta) * Math.cos(alpha),
    radius * Math.sin(delta),
    -radius * Math.cos(delta) * Math.sin(alpha),
  )
}

export const CelestialSphereCanvas = ({
  targetRa,
  targetDec,
  className = '',
  target,
  onSelect,
  semiMajor = 600,
  inclination = 30,
  animated = true,
}: Props) => {
  const host = useRef<HTMLDivElement>(null)
  const astralRef = useRef<HTMLDivElement>(null)
  const selection = useRef({
    ra: target?.ra ?? targetRa ?? 133.7951,
    dec: target?.dec ?? targetDec ?? -7.2451,
  })
  const targetId = target?.id ?? 'wise-0855'
  const callback = useRef(onSelect)
  const [fallback, setFallback] = useState(false)

  // Target orbit state references for smooth lerp transitions
  const targetOrbitProps = useRef({
    semiMajor,
    inclination,
    eccentricity: 0.65,
    animated,
  })

  useEffect(() => {
    selection.current = {
      ra: target?.ra ?? targetRa ?? 133.7951,
      dec: target?.dec ?? targetDec ?? -7.2451,
    }
    const preset = TARGET_ORBIT_CONFIG[targetId]
    targetOrbitProps.current = {
      semiMajor: preset?.semiMajor ?? semiMajor,
      inclination: preset?.inclination ?? inclination,
      eccentricity: preset?.eccentricity ?? 0.65,
      animated,
    }
  }, [target, targetRa, targetDec, targetId, semiMajor, inclination, animated])

  useEffect(() => {
    callback.current = onSelect
  }, [onSelect])

  useEffect(() => {
    const element = host.current
    if (!element) return

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'low-power',
      })
    } catch {
      queueMicrotask(() => setFallback(true))
      return
    }

    // Limit pixel ratio to 1.5 to protect 4K screens from fillrate bottlenecks
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
    renderer.setClearColor(0x000000, 0)
    renderer.domElement.setAttribute(
      'aria-label',
      'Interactive astral celestial sphere. Drag to orbit, targets also available as catalog cards.',
    )
    renderer.domElement.setAttribute('role', 'img')
    element.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(43, 1, 0.05, 100)
    camera.position.copy(vector(selection.current.ra, selection.current.dec, 9))

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.enablePan = false
    controls.minDistance = 4.5
    controls.maxDistance = 13

    // Master sphere group holding batched celestial grid
    const sphereGroup = new THREE.Group()
    scene.add(sphereGroup)

    // 1. Batched Geometry: assemble parallels, meridians, and reference planes into 1 BufferGeometry
    const gridPositions: number[] = []
    const R = 2.8

    // Parallels (declinations -75 to +75 in 15 deg steps)
    const PARALLEL_SEGS = 72
    for (let dec = -75; dec <= 75; dec += 15) {
      for (let i = 0; i < PARALLEL_SEGS; i++) {
        const ra1 = (i / PARALLEL_SEGS) * 360
        const ra2 = ((i + 1) / PARALLEL_SEGS) * 360
        const p1 = vector(ra1, dec, R)
        const p2 = vector(ra2, dec, R)
        gridPositions.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z)
      }
    }

    // Meridians (RA 0 to 345 in 15 deg steps)
    const MERIDIAN_SEGS = 36
    for (let ra = 0; ra < 360; ra += 15) {
      for (let i = 0; i < MERIDIAN_SEGS; i++) {
        const dec1 = -90 + (i / MERIDIAN_SEGS) * 180
        const dec2 = -90 + ((i + 1) / MERIDIAN_SEGS) * 180
        const p1 = vector(ra, dec1, R)
        const p2 = vector(ra, dec2, R)
        gridPositions.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z)
      }
    }

    // Celestial equator (dec = 0) with higher resolution
    const EQ_SEGS = 96
    for (let i = 0; i < EQ_SEGS; i++) {
      const ra1 = (i / EQ_SEGS) * 360
      const ra2 = ((i + 1) / EQ_SEGS) * 360
      const p1 = vector(ra1, 0, R)
      const p2 = vector(ra2, 0, R)
      gridPositions.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z)
    }

    // Single BufferGeometry and LineSegments for entire celestial grid (Draw Call 1)
    const gridGeometry = new THREE.BufferGeometry()
    gridGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(gridPositions, 3),
    )
    const gridMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.18,
    })
    const gridSegments = new THREE.LineSegments(gridGeometry, gridMaterial)
    sphereGroup.add(gridSegments)

    // 2. Planet X Orbit: Second batched LineSegments (Draw Call 2)
    const orbitGroup = new THREE.Group()
    scene.add(orbitGroup)

    const ORBIT_SEGS = 120
    const orbitPositions = new Float32Array(ORBIT_SEGS * 2 * 3)
    const orbitGeometry = new THREE.BufferGeometry()
    orbitGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(orbitPositions, 3),
    )
    const orbitMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
    })
    const orbitSegments = new THREE.LineSegments(orbitGeometry, orbitMaterial)
    orbitGroup.add(orbitSegments)

    const ORBIT_BASE_A = 1.55

    function updateOrbitBuffer(e: number) {
      let ptr = 0
      const a = ORBIT_BASE_A
      const b = a * Math.sqrt(Math.max(0, 1 - e * e))
      for (let i = 0; i < ORBIT_SEGS; i++) {
        const theta1 = (i / ORBIT_SEGS) * Math.PI * 2
        const theta2 = ((i + 1) / ORBIT_SEGS) * Math.PI * 2
        const x1 = a * (Math.cos(theta1) - e)
        const z1 = b * Math.sin(theta1)
        const x2 = a * (Math.cos(theta2) - e)
        const z2 = b * Math.sin(theta2)
        orbitPositions[ptr++] = x1
        orbitPositions[ptr++] = 0
        orbitPositions[ptr++] = z1
        orbitPositions[ptr++] = x2
        orbitPositions[ptr++] = 0
        orbitPositions[ptr++] = z2
      }
      orbitGeometry.attributes.position.needsUpdate = true
    }

    function calculateOrbitPoint(anomaly: number, e: number, a = ORBIT_BASE_A) {
      const b = a * Math.sqrt(Math.max(0, 1 - e * e))
      return new THREE.Vector3(
        a * (Math.cos(anomaly) - e),
        0,
        b * Math.sin(anomaly),
      )
    }

    // Tracer dot for Planet X orbit
    const tracer = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    )
    orbitGroup.add(tracer)

    // Target beacons (minimal crisp dots)
    const beacons: THREE.Mesh[] = []
    CURATED_TARGETS.forEach((item) => {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffff }),
      )
      mesh.position.copy(vector(item.ra, item.dec, 2.85))
      mesh.userData.targetId = item.id
      sphereGroup.add(mesh)
      beacons.push(mesh)
    })

    // Reticle indicator ring around selected target
    const reticle = new THREE.Mesh(
      new THREE.TorusGeometry(0.14, 0.005, 4, 32),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    )
    scene.add(reticle)

    // Pointer lerp inertia & parallax state
    let targetRotX = 0
    let targetRotY = 0
    let currentRotX = 0
    let currentRotY = 0

    let currentOrbitInc = targetOrbitProps.current.inclination
    let currentOrbitEcc = targetOrbitProps.current.eccentricity
    let currentOrbitScale = targetOrbitProps.current.semiMajor / 600

    updateOrbitBuffer(currentOrbitEcc)

    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()

    let dragStart = { x: 0, y: 0 }
    let hoverId = ''
    let previousSelection = ''
    let transition = false

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')

    const onPointerMove = (event: PointerEvent) => {
      const bounds = renderer.domElement.getBoundingClientRect()
      const nx = ((event.clientX - bounds.left) / bounds.width) * 2 - 1
      const ny = (-(event.clientY - bounds.top) / bounds.height) * 2 + 1
      mouse.set(nx, ny)

      // Celestial sphere inertia target
      targetRotY = nx * 0.18
      targetRotX = -ny * 0.12

      // Subtle GPU-accelerated CSS parallax on the black-hole layer
      if (astralRef.current && !reduced.matches) {
        const px = (nx * 14).toFixed(1)
        const py = (-ny * 10).toFixed(1)
        astralRef.current.style.transform = `translate3d(${px}px, ${py}px, 0)`
      }

      raycaster.setFromCamera(mouse, camera)
      const hit = raycaster.intersectObjects(beacons)[0]
      const id = hit?.object.userData.targetId as string | undefined
      if (id && id !== hoverId) playTone('hover')
      hoverId = id ?? ''
      renderer.domElement.style.cursor = id ? 'pointer' : 'grab'
    }

    const onPointerDown = (event: PointerEvent) => {
      dragStart = { x: event.clientX, y: event.clientY }
      transition = false
    }

    const onPointerUp = (event: PointerEvent) => {
      if (
        Math.hypot(event.clientX - dragStart.x, event.clientY - dragStart.y) > 5
      )
        return
      onPointerMove(event)
      const selected = CURATED_TARGETS.find((item) => item.id === hoverId)
      if (selected) {
        playTone('select')
        callback.current?.(selected)
      }
    }

    renderer.domElement.addEventListener('pointermove', onPointerMove)
    renderer.domElement.addEventListener('pointerdown', onPointerDown)
    renderer.domElement.addEventListener('pointerup', onPointerUp)

    const resize = () => {
      const w = element.clientWidth
      const h = element.clientHeight
      if (!w || !h) return
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(element)
    resize()

    // Smart pause lifecycle control
    let isIntersecting = true
    let isDocVisible = !document.hidden
    let frameId: number | null = null
    let phase = 0.8
    let lastTime = 0

    const renderFrame = (time: number) => {
      frameId = null
      const delta = lastTime ? Math.min(time - lastTime, 80) : 0
      lastTime = time

      // Smooth camera transition to target
      const id = `${selection.current.ra}:${selection.current.dec}`
      if (previousSelection !== id) {
        previousSelection = id
        transition = true
      }
      if (transition) {
        const destination = vector(
          selection.current.ra,
          selection.current.dec,
          8.8,
        )
        if (reduced.matches) camera.position.copy(destination)
        else camera.position.lerp(destination, 0.045)
        if (camera.position.distanceTo(destination) < 0.02 || reduced.matches)
          transition = false
      }

      // Reticle follow
      const selectedVec = vector(
        selection.current.ra,
        selection.current.dec,
        2.88,
      )
      reticle.position.copy(selectedVec)
      reticle.lookAt(camera.position)

      // Smooth Lerp cursor inertia on celestial sphere
      currentRotX += (targetRotX - currentRotX) * 0.05
      currentRotY += (targetRotY - currentRotY) * 0.05
      sphereGroup.rotation.x = currentRotX
      sphereGroup.rotation.y = currentRotY

      // Smooth Lerp transition of orbital inclination and eccentricity
      const targetInc = targetOrbitProps.current.inclination
      const targetEcc = targetOrbitProps.current.eccentricity
      const targetScale = targetOrbitProps.current.semiMajor / 600

      currentOrbitInc += (targetInc - currentOrbitInc) * 0.05
      const prevEcc = currentOrbitEcc
      currentOrbitEcc += (targetEcc - currentOrbitEcc) * 0.05
      currentOrbitScale += (targetScale - currentOrbitScale) * 0.05

      if (Math.abs(prevEcc - currentOrbitEcc) > 0.0005) {
        updateOrbitBuffer(currentOrbitEcc)
      }

      // Keep orbit strictly fitted within the R = 2.8 celestial sphere
      const maxAllowedScale = 2.65 / (ORBIT_BASE_A * (1 + currentOrbitEcc))
      const boundedScale = Math.min(currentOrbitScale, maxAllowedScale)

      orbitGroup.scale.setScalar(boundedScale)
      orbitGroup.rotation.x = THREE.MathUtils.degToRad(currentOrbitInc)

      if (!reduced.matches && targetOrbitProps.current.animated) {
        phase += delta * 0.00015
      }
      tracer.position.copy(calculateOrbitPoint(phase, currentOrbitEcc))

      controls.update()
      renderer.render(scene, camera)

      // Schedule next frame only if still visible
      if (isIntersecting && isDocVisible) {
        frameId = requestAnimationFrame(renderFrame)
      }
    }

    const startLoop = () => {
      if (frameId === null && isIntersecting && isDocVisible) {
        lastTime = performance.now()
        frameId = requestAnimationFrame(renderFrame)
      }
    }

    const stopLoop = () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId)
        frameId = null
      }
    }

    // Smart pause via IntersectionObserver
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      isIntersecting = entry.isIntersecting
      if (isIntersecting) {
        startLoop()
      } else {
        stopLoop()
      }
    })
    visibilityObserver.observe(element)

    // Smart pause via Page Visibility API
    const onVisibilityChange = () => {
      isDocVisible = !document.hidden
      if (isDocVisible) {
        startLoop()
      } else {
        stopLoop()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    startLoop()

    return () => {
      stopLoop()
      resizeObserver.disconnect()
      visibilityObserver.disconnect()
      document.removeEventListener('visibilitychange', onVisibilityChange)
      controls.dispose()
      renderer.domElement.removeEventListener('pointermove', onPointerMove)
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer.domElement.removeEventListener('pointerup', onPointerUp)

      scene.traverse((object) => {
        if (
          object instanceof THREE.Mesh ||
          object instanceof THREE.Line ||
          object instanceof THREE.LineSegments ||
          object instanceof THREE.Points
        ) {
          object.geometry.dispose()
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material]
          materials.forEach((material) => material.dispose())
        }
      })
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [targetId])

  return (
    <div className={`celestial-container ${className}`}>
      {/* Layer 1: GPU-accelerated CSS Astral Horizon & Accretion Halo */}
      <div className="astral-underlay-wrap" aria-hidden="true">
        <div className="astral-black-hole" ref={astralRef}>
          <div className="astral-lensing-arc" />
          <div className="astral-accretion-disk" />
          <div className="astral-shadow" />
          <div className="astral-photon-ring" />
        </div>
      </div>

      {/* Layer 2: Transparent Three.js WebGL canvas */}
      <div className="webgl-host" ref={host} />

      {fallback && (
        <div className="webgl-fallback">
          <svg
            viewBox="0 0 600 420"
            aria-label="Static celestial reference grid"
          >
            <ellipse cx="300" cy="210" rx="185" ry="185" />
            <ellipse cx="300" cy="210" rx="75" ry="185" />
            <ellipse cx="300" cy="210" rx="145" ry="185" />
            <ellipse cx="300" cy="210" rx="185" ry="70" />
            <path d="M115 210H485M300 25V395" />
          </svg>
          <p>WebGL unavailable · use target controls below</p>
        </div>
      )}
    </div>
  )
}
