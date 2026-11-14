import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { CURATED_TARGETS, type EnhancedTarget } from '../../api/client'
import { formatDec, formatRA } from '../../utils/astronomy'
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
  const selection = useRef({
    ra: target?.ra ?? targetRa ?? 133.7951,
    dec: target?.dec ?? targetDec ?? -7.2451,
  })
  const parameters = useRef({ semiMajor, inclination, animated })
  const callback = useRef(onSelect)
  const [fallback, setFallback] = useState(false)
  const [readout, setReadout] = useState<{ ra: number; dec: number } | null>(
    null,
  )
  useEffect(() => {
    selection.current = {
      ra: target?.ra ?? targetRa ?? 133.7951,
      dec: target?.dec ?? targetDec ?? -7.2451,
    }
  }, [target, targetRa, targetDec])
  useEffect(() => {
    parameters.current = { semiMajor, inclination, animated }
    callback.current = onSelect
  }, [semiMajor, inclination, animated, onSelect])
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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
    renderer.setClearColor(0x06080d, 0)
    renderer.domElement.setAttribute(
      'aria-label',
      'Interactive ICRS sky schematic. Drag to orbit, scroll to zoom; targets also available as buttons below.',
    )
    renderer.domElement.setAttribute('role', 'img')
    element.appendChild(renderer.domElement)
    const scene = new THREE.Scene(),
      camera = new THREE.PerspectiveCamera(43, 1, 0.05, 100)
    camera.position.copy(vector(selection.current.ra, selection.current.dec, 9))
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.06
    controls.enablePan = false
    controls.minDistance = 4.5
    controls.maxDistance = 13
    const sphere = new THREE.Group()
    scene.add(sphere)
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.16,
    })
    function line(
      points: THREE.Vector3[],
      material = lineMaterial,
      parent: THREE.Object3D = sphere,
    ) {
      const object = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        material,
      )
      parent.add(object)
      return object
    }
    for (let ra = 0; ra < 360; ra += 15)
      line(Array.from({ length: 91 }, (_, i) => vector(ra, -90 + i * 2)))
    for (let dec = -75; dec <= 75; dec += 15)
      line(Array.from({ length: 181 }, (_, i) => vector(i * 2, dec)))
    line(
      Array.from({ length: 181 }, (_, i) => vector(i * 2, 0)),
      new THREE.LineBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.55,
      }),
    )
    function plane(pole: THREE.Vector3, color: number) {
      const group = new THREE.Group()
      group.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        pole.normalize(),
      )
      scene.add(group)
      line(
        Array.from(
          { length: 181 },
          (_, i) =>
            new THREE.Vector3(
              Math.cos((i * Math.PI) / 90) * 2.83,
              0,
              Math.sin((i * Math.PI) / 90) * 2.83,
            ),
        ),
        new THREE.LineBasicMaterial({
          color,
          transparent: true,
          opacity: 0.65,
        }),
        group,
      )
    }
    plane(vector(270, 66.5607, 1), 0x00f0ff)
    plane(vector(192.85948, 27.12825, 1), 0xa855f7)
    const points = new Float32Array(1800)
    let seed = 1977
    const random = () => {
      seed = (seed * 16807) % 2147483647
      return seed / 2147483647
    }
    for (let i = 0; i < points.length; i += 3) {
      const p = vector(
        random() * 360,
        (Math.asin(random() * 2 - 1) * 180) / Math.PI,
        17 + random() * 8,
      )
      points[i] = p.x
      points[i + 1] = p.y
      points[i + 2] = p.z
    }
    const stars = new THREE.BufferGeometry()
    stars.setAttribute('position', new THREE.BufferAttribute(points, 3))
    scene.add(
      new THREE.Points(
        stars,
        new THREE.PointsMaterial({
          size: 0.025,
          color: 0xa5b5c5,
          transparent: true,
          opacity: 0.65,
        }),
      ),
    )
    const beacons: THREE.Mesh[] = []
    CURATED_TARGETS.forEach((item) => {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.065, 12, 12),
        new THREE.MeshBasicMaterial({
          color: item.id === 'wise-0855' ? 0xff7700 : 0x00f0ff,
        }),
      )
      mesh.position.copy(vector(item.ra, item.dec, 2.85))
      mesh.userData.targetId = item.id
      scene.add(mesh)
      beacons.push(mesh)
    })
    const reticle = new THREE.Mesh(
      new THREE.TorusGeometry(0.16, 0.006, 6, 48),
      new THREE.MeshBasicMaterial({ color: 0xff7700 }),
    )
    scene.add(reticle)
    const orbitGroup = new THREE.Group()
    scene.add(orbitGroup)
    function orbitalPoint(anomaly: number) {
      return new THREE.Vector3(
        3.45 * (Math.cos(anomaly) - 0.65),
        0,
        3.45 * Math.sqrt(1 - 0.65 ** 2) * Math.sin(anomaly),
      )
    }
    line(
      Array.from({ length: 241 }, (_, i) => orbitalPoint((i * Math.PI) / 120)),
      new THREE.LineBasicMaterial({
        color: 0xff7700,
        transparent: true,
        opacity: 0.6,
      }),
      orbitGroup,
    )
    const tracer = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0xffb15c }),
    )
    orbitGroup.add(tracer)
    const flow = Array.from({ length: 16 }, (_, i) => {
      const p = new THREE.Mesh(
        new THREE.SphereGeometry(0.016, 6, 6),
        new THREE.MeshBasicMaterial({
          color: 0xff7700,
          transparent: true,
          opacity: 0.8 - i * 0.04,
        }),
      )
      orbitGroup.add(p)
      return p
    })
    const raycaster = new THREE.Raycaster(),
      mouse = new THREE.Vector2(),
      raySphere = new THREE.Sphere(new THREE.Vector3(), 2.8)
    let dragStart = { x: 0, y: 0 },
      hoverId = '',
      lastReadout = 0,
      previousSelection = '',
      transition = false
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const pointer = (event: PointerEvent) => {
      const bounds = renderer.domElement.getBoundingClientRect()
      mouse.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        (-(event.clientY - bounds.top) / bounds.height) * 2 + 1,
      )
      raycaster.setFromCamera(mouse, camera)
      const hit = raycaster.intersectObjects(beacons)[0]
      const id = hit?.object.userData.targetId as string | undefined
      if (id && id !== hoverId) playTone('hover')
      hoverId = id ?? ''
      renderer.domElement.style.cursor = id ? 'pointer' : 'grab'
      const point = raycaster.ray.intersectSphere(
        raySphere,
        new THREE.Vector3(),
      )
      if (point && performance.now() - lastReadout > 80) {
        lastReadout = performance.now()
        setReadout({
          ra: ((Math.atan2(-point.z, point.x) * 180) / Math.PI + 360) % 360,
          dec: (Math.asin(point.y / 2.8) * 180) / Math.PI,
        })
      }
    }
    const down = (event: PointerEvent) => {
      dragStart = { x: event.clientX, y: event.clientY }
      transition = false
    }
    const up = (event: PointerEvent) => {
      if (
        Math.hypot(event.clientX - dragStart.x, event.clientY - dragStart.y) > 5
      )
        return
      pointer(event)
      const selected = CURATED_TARGETS.find((item) => item.id === hoverId)
      if (selected) {
        playTone('select')
        callback.current?.(selected)
      }
    }
    renderer.domElement.addEventListener('pointermove', pointer)
    renderer.domElement.addEventListener('pointerdown', down)
    renderer.domElement.addEventListener('pointerup', up)
    const resize = () => {
      const w = element.clientWidth,
        h = element.clientHeight
      if (!w || !h) return
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(element)
    resize()
    let frame = 0,
      phase = 0.8,
      lastTime = 0
    const animate = (time: number) => {
      frame = requestAnimationFrame(animate)
      const delta = lastTime ? Math.min(time - lastTime, 80) : 0
      lastTime = time
      if (document.hidden) return
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
      const selected = vector(selection.current.ra, selection.current.dec, 2.88)
      reticle.position.copy(selected)
      reticle.lookAt(camera.position)
      orbitGroup.scale.setScalar(parameters.current.semiMajor / 600)
      orbitGroup.rotation.x = THREE.MathUtils.degToRad(
        parameters.current.inclination,
      )
      // Illustrative eccentric-anomaly flow, NOT an ephemeris or a predicted position.
      if (!reduced.matches && parameters.current.animated)
        phase += delta * 0.00015
      tracer.position.copy(orbitalPoint(phase))
      flow.forEach((particle, index) =>
        particle.position.copy(orbitalPoint(phase - index * 0.025)),
      )
      controls.update()
      renderer.render(scene, camera)
    }
    frame = requestAnimationFrame(animate)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      controls.dispose()
      renderer.domElement.removeEventListener('pointermove', pointer)
      renderer.domElement.removeEventListener('pointerdown', down)
      renderer.domElement.removeEventListener('pointerup', up)
      scene.traverse((object) => {
        if (
          object instanceof THREE.Mesh ||
          object instanceof THREE.Line ||
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
  }, [])
  return (
    <div className={`celestial-container ${className}`}>
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
      <div className="viewport-label">
        <span className="status-dot" />
        ICRS CELESTIAL SCHEMATIC
        <small>DECORATIVE STARS · NOT A SURVEY IMAGE</small>
      </div>
      <div className="viewport-coords">
        <small>CURSOR / EQUATORIAL</small>
        <span>{readout ? formatRA(readout.ra) : '—h —m —s'}</span>
        <span>{readout ? formatDec(readout.dec) : '±—° —′ —″'}</span>
      </div>
      <div className="viewport-legend">
        <span>
          <i />
          EQUATOR / ECLIPTIC
        </span>
        <span>
          <i className="violet" />
          GALACTIC PLANE
        </span>
        <span>
          <i className="amber" />
          HYPOTHETICAL ORBIT
        </span>
      </div>
    </div>
  )
}
