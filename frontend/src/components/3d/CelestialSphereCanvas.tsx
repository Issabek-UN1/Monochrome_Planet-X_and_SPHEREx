import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'

interface CelestialSphereProps {
  targetRa?: number
  targetDec?: number
  className?: string
}

export const CelestialSphereCanvas: React.FC<CelestialSphereProps> = ({
  targetRa = 133.795,
  targetDec = -7.245,
  className = '',
}) => {
  const mountRef = useRef<HTMLDivElement>(null)
  const targetCoordsRef = useRef({ ra: targetRa, dec: targetDec })

  useEffect(() => {
    targetCoordsRef.current = { ra: targetRa, dec: targetDec }
  }, [targetRa, targetDec])

  useEffect(() => {
    const container = mountRef.current
    if (!container) return

    let animationFrameId: number
    const width = container.clientWidth
    const height = container.clientHeight

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x030305, 0.035)

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100)
    camera.position.set(0, 3.2, 9.2)
    camera.lookAt(0, -1.0, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height)
    renderer.setClearColor(0x030305, 0)
    container.appendChild(renderer.domElement)

    // 2. Starfield
    const starCount = 1400
    const starGeometry = new THREE.BufferGeometry()
    const starPositions = new Float32Array(starCount * 3)

    for (let i = 0; i < starCount; i++) {
      starPositions[i * 3] = (Math.random() - 0.5) * 50
      starPositions[i * 3 + 1] = (Math.random() - 0.5) * 40
      starPositions[i * 3 + 2] = (Math.random() - 0.5) * 35 - 5
    }

    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3))

    const starMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.045,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    })
    const starField = new THREE.Points(starGeometry, starMaterial)
    scene.add(starField)

    // 3. SPHEREx Celestial Sphere (Wireframe Grid)
    const sphereRadius = 4.4
    const sphereGeo = new THREE.SphereGeometry(sphereRadius, 36, 18)
    const edges = new THREE.EdgesGeometry(sphereGeo)
    const sphereMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.18,
    })
    const wireframeSphere = new THREE.LineSegments(edges, sphereMat)
    wireframeSphere.position.set(0, -3.9, 0)
    scene.add(wireframeSphere)

    // Dark core occlusion
    const coreGeo = new THREE.SphereGeometry(sphereRadius * 0.992, 32, 16)
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0x04060b,
      transparent: true,
      opacity: 0.94,
    })
    const coreMesh = new THREE.Mesh(coreGeo, coreMat)
    wireframeSphere.add(coreMesh)

    // Celestial Equator (Bright ring at Dec = 0)
    const equatorGeo = new THREE.RingGeometry(sphereRadius - 0.01, sphereRadius + 0.02, 72)
    const equatorMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.45,
    })
    const equatorRing = new THREE.Mesh(equatorGeo, equatorMat)
    equatorRing.rotation.x = Math.PI / 2
    wireframeSphere.add(equatorRing)

    // 4. Planet X Theoretical Tilted Orbit (Saturn-like concentric elliptical rings)
    const ringGroup = new THREE.Group()
    ringGroup.position.set(0, -3.9, 0)
    ringGroup.rotation.x = Math.PI / 3.8
    ringGroup.rotation.y = Math.PI / 6.5

    const ringRadii = [5.4, 5.8, 6.3, 6.9, 7.6, 8.4]
    ringRadii.forEach((r, idx) => {
      const ringGeo = new THREE.RingGeometry(r, r + 0.025, 96)
      const ringMat = new THREE.MeshBasicMaterial({
        color: idx % 2 === 0 ? 0xff6b35 : 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: idx === 1 || idx === 3 ? 0.38 : 0.14,
      })
      const ringMesh = new THREE.Mesh(ringGeo, ringMat)
      ringMesh.rotation.x = Math.PI / 2
      ringGroup.add(ringMesh)
    })
    scene.add(ringGroup)

    // 5. Active Target Pulsing Beacon on Sphere Surface
    const beaconGeo = new THREE.SphereGeometry(0.12, 16, 16)
    const beaconMat = new THREE.MeshBasicMaterial({
      color: 0xff6b35,
      transparent: true,
      opacity: 0.9,
    })
    const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat)

    // Beacon outer glow halo
    const haloGeo = new THREE.RingGeometry(0.16, 0.28, 32)
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7,
    })
    const haloMesh = new THREE.Mesh(haloGeo, haloMat)
    beaconMesh.add(haloMesh)
    wireframeSphere.add(beaconMesh)

    // Target pointer line from center to surface
    const pointerGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, sphereRadius * 1.15),
    ])
    const pointerMat = new THREE.LineDashedMaterial({
      color: 0xf59e0b,
      dashSize: 0.2,
      gapSize: 0.1,
      transparent: true,
      opacity: 0.6,
    })
    const pointerLine = new THREE.Line(pointerGeo, pointerMat)
    pointerLine.computeLineDistances()
    wireframeSphere.add(pointerLine)

    // 6. Interaction & Animation State
    let mouseX = 0
    let mouseY = 0
    let targetMouseX = 0
    let targetMouseY = 0

    const handleMouseMove = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      mouseX = ((event.clientX - rect.left) / rect.width) * 2 - 1
      mouseY = -(((event.clientY - rect.top) / rect.height) * 2 - 1)
    }

    window.addEventListener('mousemove', handleMouseMove)
    const clock = new THREE.Clock()

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate)
      const elapsedTime = clock.getElapsedTime()

      // Damped mouse movement
      targetMouseX += (mouseX - targetMouseX) * 0.05
      targetMouseY += (mouseY - targetMouseY) * 0.05

      // Convert target RA & Dec to position on sphere surface
      const radRa = (targetCoordsRef.current.ra * Math.PI) / 180
      const radDec = (targetCoordsRef.current.dec * Math.PI) / 180

      const beaconX = sphereRadius * Math.cos(radDec) * Math.sin(radRa)
      const beaconY = sphereRadius * Math.sin(radDec)
      const beaconZ = sphereRadius * Math.cos(radDec) * Math.cos(radRa)

      beaconMesh.position.set(beaconX, beaconY, beaconZ)
      haloMesh.lookAt(camera.position)

      // Pointer line points toward beacon
      pointerLine.lookAt(beaconX, beaconY, beaconZ)

      // Pulse the beacon
      const pulse = 1 + Math.sin(elapsedTime * 6) * 0.25
      beaconMesh.scale.set(pulse, pulse, pulse)

      // Sphere rotation with continuous subtle spin + orientation toward target
      wireframeSphere.rotation.y = elapsedTime * 0.03 + targetMouseX * 0.2
      wireframeSphere.rotation.x = targetMouseY * 0.1

      ringGroup.rotation.z = -elapsedTime * 0.015 + targetMouseX * 0.15
      starField.rotation.y = elapsedTime * 0.004

      renderer.render(scene, camera)
    }

    animate()

    // 7. Resize handling
    const handleResize = () => {
      if (!container) return
      const newWidth = container.clientWidth
      const newHeight = container.clientHeight
      camera.aspect = newWidth / newHeight
      camera.updateProjectionMatrix()
      renderer.setSize(newWidth, newHeight)
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(animationFrameId)
      renderer.dispose()
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [])

  return (
    <div
      ref={mountRef}
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      style={{ zIndex: 0 }}
    />
  )
}
