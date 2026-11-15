# Response from Gemini Hydrogen (Высокий)
Date: 2026-11-15
Source: https://gemini.google.com/app (Model: Hydrogen · Высокий)

================================================================================
1. Astral Lensing Horizon (src/components/AstralHorizonCanvas.tsx & src/components/CelestialSphereCanvas.tsx)

This replaces the 3D wireframe globe with a 60fps HTML5 Canvas 2D relativistic gravitational lensing horizon and perspective-projected topological wireframe plane. It runs with 0.05 requestAnimationFrame mouse-parallax inertia and smoothly interpolates wave amplitude, frequency, phase velocity, and horizon tilt across all five SPHEREx targets.

src/components/AstralHorizonCanvas.tsx
TypeScript
```typescript
import React, { useEffect, useRef } from 'react';

export type TargetId =
  | 'wise-0855'
  | 'barnards-star'
  | 'epsilon-indi-b'
  | 'rw-aurigae'
  | 'r-draconis';

export interface AstralHorizonCanvasProps {
  activeTargetId?: TargetId | null;
  target?: { id: string };
  targetRa?: number;
  targetDec?: number;
  onSelect?: (target: any) => void;
  semiMajor?: number;
  inclination?: number;
  animated?: boolean;
  className?: string;
}

interface HorizonSignature {
  waveAmplitude: number;
  waveFrequency: number;
  waveSpeed: number;
  tiltAngle: number;
  lensingRadius: number;
  haloIntensity: number;
  dopplerBias: number;
  secondaryHarmonic: number;
  wellDepth: number;
}

const DEFAULT_SIGNATURE: HorizonSignature = {
  waveAmplitude: 16,
  waveFrequency: 5.2,
  waveSpeed: 0.55,
  tiltAngle: -0.045,
  lensingRadius: 118,
  haloIntensity: 0.8,
  dopplerBias: 0.16,
  secondaryHarmonic: 0.22,
  wellDepth: 34,
};

const TARGET_SIGNATURES: Record<TargetId, HorizonSignature> = {
  // Ultra-cold Y-dwarf: deep, slow thermal swell & subtle negative inclination
  'wise-0855': {
    waveAmplitude: 14,
    waveFrequency: 4.4,
    waveSpeed: 0.42,
    tiltAngle: -0.062,
    lensingRadius: 114,
    haloIntensity: 0.74,
    dopplerBias: 0.14,
    secondaryHarmonic: 0.15,
    wellDepth: 30,
  },
  // High proper-motion red dwarf: taut, high-velocity harmonic ripples
  'barnards-star': {
    waveAmplitude: 20,
    waveFrequency: 7.4,
    waveSpeed: 0.86,
    tiltAngle: 0.048,
    lensingRadius: 122,
    haloIntensity: 0.86,
    dopplerBias: -0.22,
    secondaryHarmonic: 0.24,
    wellDepth: 36,
  },
  // Binary brown dwarf pair: dual-harmonic interference beat wave
  'epsilon-indi-b': {
    waveAmplitude: 23,
    waveFrequency: 6.1,
    waveSpeed: 0.68,
    tiltAngle: -0.088,
    lensingRadius: 130,
    haloIntensity: 0.9,
    dopplerBias: 0.26,
    secondaryHarmonic: 0.58,
    wellDepth: 40,
  },
  // Young variable T Tauri disk system: pronounced tilt & sweeping accretion wave
  'rw-aurigae': {
    waveAmplitude: 28,
    waveFrequency: 7.9,
    waveSpeed: 0.94,
    tiltAngle: 0.112,
    lensingRadius: 138,
    haloIntensity: 0.96,
    dopplerBias: 0.34,
    secondaryHarmonic: 0.42,
    wellDepth: 46,
  },
  // Mira-type pulsating red giant: expansive long-period radial oscillation
  'r-draconis': {
    waveAmplitude: 25,
    waveFrequency: 3.9,
    waveSpeed: 0.38,
    tiltAngle: -0.026,
    lensingRadius: 144,
    haloIntensity: 0.88,
    dopplerBias: -0.15,
    secondaryHarmonic: 0.28,
    wellDepth: 44,
  },
};

function lerp(start: number, end: number, factor: number): number {
  return start + (end - start) * factor;
}

export const AstralHorizonCanvas: React.FC<AstralHorizonCanvasProps> = ({
  activeTargetId,
  target,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const effectiveId = (target?.id ?? activeTargetId ?? 'wise-0855') as TargetId;
  const targetSignatureRef = useRef<HorizonSignature>(
    TARGET_SIGNATURES[effectiveId] ?? DEFAULT_SIGNATURE
  );

  useEffect(() => {
    targetSignatureRef.current = TARGET_SIGNATURES[effectiveId] ?? DEFAULT_SIGNATURE;
  }, [effectiveId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let animationFrameId = 0;
    let lastTimestamp = performance.now();
    let phase = 0;

    // Lerped state for silky 60fps parameter morphing
    const currentSig: HorizonSignature = { ...targetSignatureRef.current };

    // Mouse parallax state with 0.05 inertia damping
    const targetMouse = { x: 0, y: 0 };
    const currentMouse = { x: 0, y: 0 };

    const updateDimensions = () => {
      const parent = canvas.parentElement;
      if (!parent) return;

      const rect = parent.getBoundingClientRect();
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    };

    updateDimensions();
    const resizeObserver = new ResizeObserver(updateDimensions);
    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }

    const handlePointerMove = (e: PointerEvent) => {
      if (width === 0 || height === 0) return;
      const nx = (e.clientX / width) * 2 - 1;
      const ny = (e.clientY / height) * 2 - 1;
      targetMouse.x = Math.max(-1, Math.min(1, nx));
      targetMouse.y = Math.max(-1, Math.min(1, ny));
    };

    const handlePointerLeave = () => {
      targetMouse.x = 0;
      targetMouse.y = 0;
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    document.addEventListener('mouseleave', handlePointerLeave);

    const drawWireframePlane = (
      horizonX: number,
      horizonY: number,
      tilt: number,
      parallaxX: number,
      parallaxY: number
    ) => {
      const cols = 46;
      const rows = 24;

      const planeWidth = Math.min(width * 0.92, 1180);
      const planeDepth = Math.min(height * 0.56, 480);
      const originX = horizonX + width * 0.05 + parallaxX * 1.35;
      const originY = horizonY + 18 + parallaxY * 1.15;

      const cosT = Math.cos(tilt * 0.75);
      const sinT = Math.sin(tilt * 0.75);

      const projectPoint = (u: number, v: number) => {
        const perspective = 0.62 + (v + 1) * 0.28;
        const rawX = u * (planeWidth * 0.52) * perspective;
        const rawY = v * (planeDepth * 0.42) * perspective;

        const primaryWave =
          Math.sin(u * currentSig.waveFrequency + phase) *
          Math.cos(v * (currentSig.waveFrequency * 0.62) - phase * 0.55);

        const secondaryWave =
          Math.sin(
            (u * 1.65 + v * 0.95) * currentSig.waveFrequency - phase * 1.25
          ) * currentSig.secondaryHarmonic;

        const dxWell = u + 0.18;
        const dyWell = v + 0.15;
        const distSq = dxWell * dxWell * 2.4 + dyWell * dyWell * 3.2;
        const gravitationalWell =
          -currentSig.wellDepth * Math.exp(-distSq * 3.8);

        const displacementZ =
          (primaryWave + secondaryWave) * currentSig.waveAmplitude * perspective +
          gravitationalWell * perspective;

        const tiltedX = rawX * cosT - (rawY + displacementZ) * sinT;
        const tiltedY = rawX * sinT + (rawY + displacementZ) * cosT;

        const edgeFadeX = Math.max(0, 1 - Math.pow(Math.abs(u), 2.4));
        const edgeFadeY = Math.max(0, 1 - Math.pow(Math.abs(v), 2.1));
        const alpha = edgeFadeX * edgeFadeY;

        return {
          x: originX + tiltedX,
          y: originY + tiltedY,
          alpha,
          crest: Math.max(0, primaryWave + secondaryWave * 0.5),
        };
      };

      const grid: Array<
        Array<{ x: number; y: number; alpha: number; crest: number }>
      > = new Array(rows);

      for (let r = 0; r < rows; r++) {
        const v = (r / (rows - 1)) * 2 - 1;
        const rowArr = new Array(cols);
        for (let c = 0; c < cols; c++) {
          const u = (c / (cols - 1)) * 2 - 1;
          rowArr[c] = projectPoint(u, v);
        }
        grid[r] = rowArr;
      }

      ctx.save();
      ctx.lineWidth = 1;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols - 1; c++) {
          const p0 = grid[r][c];
          const p1 = grid[r][c + 1];
          const segAlpha = Math.min(p0.alpha, p1.alpha);
          if (segAlpha < 0.015) continue;

          const crestBoost = Math.max(0, (p0.crest + p1.crest) * 0.5) * 0.11;
          const strokeOpacity = Math.min(0.32, segAlpha * (0.14 + crestBoost));
          ctx.strokeStyle = `rgba(255, 255, 255, ${strokeOpacity.toFixed(4)})`;
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.stroke();
        }
      }

      for (let c = 0; c < cols; c += 2) {
        for (let r = 0; r < rows - 1; r++) {
          const p0 = grid[r][c];
          const p1 = grid[r + 1][c];
          const segAlpha = Math.min(p0.alpha, p1.alpha);
          if (segAlpha < 0.02) continue;

          const strokeOpacity = segAlpha * 0.085;
          ctx.strokeStyle = `rgba(232, 236, 242, ${strokeOpacity.toFixed(4)})`;
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.stroke();
        }
      }

      for (let r = 4; r < rows - 4; r += 5) {
        for (let c = 6; c < cols - 6; c += 6) {
          const pt = grid[r][c];
          if (pt.alpha < 0.35) continue;
          const tickAlpha = pt.alpha * 0.34;
          ctx.strokeStyle = `rgba(255, 255, 255, ${tickAlpha.toFixed(4)})`;
          ctx.beginPath();
          ctx.moveTo(pt.x - 2.5, pt.y);
          ctx.lineTo(pt.x + 2.5, pt.y);
          ctx.moveTo(pt.x, pt.y - 2.5);
          ctx.lineTo(pt.x, pt.y + 2.5);
          ctx.stroke();
        }
      }

      ctx.restore();
    };

    const drawGravitationalLensingHorizon = (
      cx: number,
      cy: number,
      tilt: number
    ) => {
      const r = currentSig.lensingRadius * (width < 768 ? 0.72 : 1);
      const intensity = currentSig.haloIntensity;
      const doppler = currentSig.dopplerBias;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(tilt);

      // 1. Wide ambient silver-white relativistic corona
      ctx.save();
      ctx.scale(2.5, 0.72);
      const coronaGrad = ctx.createRadialGradient(0, 0, r * 0.25, 0, 0, r * 2.1);
      coronaGrad.addColorStop(
        0,
        `rgba(240, 244, 250, ${(0.11 * intensity).toFixed(4)})`
      );
      coronaGrad.addColorStop(
        0.45,
        `rgba(210, 218, 228, ${(0.045 * intensity).toFixed(4)})`
      );
      coronaGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = coronaGrad;
      ctx.beginPath();
      ctx.arc(0, 0, r * 2.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 2. Upper bent gravitational lensing light arc (primary Einstein arch)
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const upperArcRadius = r * 1.06;
      const upperGlow = ctx.createRadialGradient(
        r * doppler * 0.45,
        -r * 0.22,
        upperArcRadius * 0.78,
        0,
        -r * 0.08,
        upperArcRadius * 1.42
      );
      upperGlow.addColorStop(0, 'rgba(255, 255, 255, 0)');
      upperGlow.addColorStop(
        0.42,
        `rgba(255, 255, 255, ${(0.44 * intensity).toFixed(4)})`
      );
      upperGlow.addColorStop(
        0.65,
        `rgba(222, 228, 238, ${(0.14 * intensity).toFixed(4)})`
      );
      upperGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = upperGlow;
      ctx.beginPath();
      ctx.arc(0, -r * 0.05, upperArcRadius * 1.42, Math.PI, 0, false);
      ctx.fill();

      // Secondary inverted lower lensed image arc
      const lowerGlow = ctx.createRadialGradient(
        -r * doppler * 0.3,
        r * 0.16,
        r * 0.72,
        0,
        r * 0.06,
        r * 1.24
      );
      lowerGlow.addColorStop(0, 'rgba(255, 255, 255, 0)');
      lowerGlow.addColorStop(
        0.48,
        `rgba(235, 240, 248, ${(0.24 * intensity).toFixed(4)})`
      );
      lowerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = lowerGlow;
      ctx.beginPath();
      ctx.arc(0, r * 0.04, r * 1.24, 0, Math.PI, false);
      ctx.fill();
      ctx.restore();

      // 3. Pure #000000 Event Horizon Shadow Core
      const shadowRadius = r * 0.86;
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(0, 0, shadowRadius, 0, Math.PI * 2);
      ctx.fill();

      // Razor-sharp 1px Photon Ring
      const photonGrad = ctx.createLinearGradient(
        -shadowRadius,
        -shadowRadius * 0.4,
        shadowRadius,
        shadowRadius * 0.4
      );
      const leftBright = doppler < 0 ? 0.88 : 0.24;
      const rightBright = doppler >= 0 ? 0.88 : 0.24;
      photonGrad.addColorStop(
        0,
        `rgba(255, 255, 255, ${(leftBright * intensity).toFixed(4)})`
      );
      photonGrad.addColorStop(
        0.5,
        `rgba(255, 255, 255, ${(0.62 * intensity).toFixed(4)})`
      );
      photonGrad.addColorStop(
        1,
        `rgba(255, 255, 255, ${(rightBright * intensity).toFixed(4)})`
      );
      ctx.strokeStyle = photonGrad;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, shadowRadius + 0.5, 0, Math.PI * 2);
      ctx.stroke();

      // 4. Relativistic Horizontal Accretion Horizon Beam
      const beamHalfSpan = Math.min(width * 0.52, r * 4.8);
      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      const sheetGrad = ctx.createLinearGradient(
        -beamHalfSpan,
        0,
        beamHalfSpan,
        0
      );
      sheetGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
      sheetGrad.addColorStop(
        0.26,
        `rgba(220, 226, 236, ${(0.12 * intensity).toFixed(4)})`
      );
      sheetGrad.addColorStop(
        0.5 + doppler * 0.12,
        `rgba(255, 255, 255, ${(0.52 * intensity).toFixed(4)})`
      );
      sheetGrad.addColorStop(
        0.74,
        `rgba(220, 226, 236, ${(0.12 * intensity).toFixed(4)})`
      );
      sheetGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = sheetGrad;
      ctx.beginPath();
      ctx.moveTo(-beamHalfSpan, 0);
      ctx.quadraticCurveTo(0, -5.5, beamHalfSpan, 0);
      ctx.quadraticCurveTo(0, 5.5, -beamHalfSpan, 0);
      ctx.closePath();
      ctx.fill();

      const hairlineGrad = ctx.createLinearGradient(
        -beamHalfSpan * 0.92,
        0,
        beamHalfSpan * 0.92,
        0
      );
      hairlineGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
      hairlineGrad.addColorStop(
        0.22,
        `rgba(255, 255, 255, ${(0.28 * intensity).toFixed(4)})`
      );
      hairlineGrad.addColorStop(
        0.5 + doppler * 0.1,
        `rgba(255, 255, 255, ${(0.95 * intensity).toFixed(4)})`
      );
      hairlineGrad.addColorStop(
        0.78,
        `rgba(255, 255, 255, ${(0.28 * intensity).toFixed(4)})`
      );
      hairlineGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.strokeStyle = hairlineGrad;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-beamHalfSpan * 0.92, 0);
      ctx.lineTo(beamHalfSpan * 0.92, 0);
      ctx.stroke();

      ctx.restore();
      ctx.restore();
    };

    const render = (now: number) => {
      const dt = Math.min(0.05, (now - lastTimestamp) / 1000);
      lastTimestamp = now;

      // 1. Lerp mouse parallax with exact 0.05 damping factor
      currentMouse.x += (targetMouse.x - currentMouse.x) * 0.05;
      currentMouse.y += (targetMouse.y - currentMouse.y) * 0.05;

      // 2. Smoothly morph target harmonic parameters
      const targetSig = targetSignatureRef.current;
      const morphRate = 0.045;
      currentSig.waveAmplitude = lerp(
        currentSig.waveAmplitude,
        targetSig.waveAmplitude,
        morphRate
      );
      currentSig.waveFrequency = lerp(
        currentSig.waveFrequency,
        targetSig.waveFrequency,
        morphRate
      );
      currentSig.waveSpeed = lerp(
        currentSig.waveSpeed,
        targetSig.waveSpeed,
        morphRate
      );
      currentSig.tiltAngle = lerp(
        currentSig.tiltAngle,
        targetSig.tiltAngle,
        morphRate
      );
      currentSig.lensingRadius = lerp(
        currentSig.lensingRadius,
        targetSig.lensingRadius,
        morphRate
      );
      currentSig.haloIntensity = lerp(
        currentSig.haloIntensity,
        targetSig.haloIntensity,
        morphRate
      );
      currentSig.dopplerBias = lerp(
        currentSig.dopplerBias,
        targetSig.dopplerBias,
        morphRate
      );
      currentSig.secondaryHarmonic = lerp(
        currentSig.secondaryHarmonic,
        targetSig.secondaryHarmonic,
        morphRate
      );
      currentSig.wellDepth = lerp(
        currentSig.wellDepth,
        targetSig.wellDepth,
        morphRate
      );

      const motionScale = prefersReducedMotion ? 0.15 : 1;
      phase += dt * currentSig.waveSpeed * 1.45 * motionScale;

      ctx.save();
      ctx.scale(dpr, dpr);

      // Pure #000000 deep space void
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);

      const isCompact = width < 920;
      const baseHorizonX = isCompact ? width * 0.56 : width * 0.64;
      const baseHorizonY = isCompact ? height * 0.36 : height * 0.43;

      const parallaxX = currentMouse.x * 22;
      const parallaxY = currentMouse.y * 14;
      const effectiveTilt =
        currentSig.tiltAngle + currentMouse.x * 0.032 - currentMouse.y * 0.018;

      const horizonX = baseHorizonX + parallaxX;
      const horizonY = baseHorizonY + parallaxY;

      drawWireframePlane(
        horizonX,
        horizonY,
        effectiveTilt,
        parallaxX,
        parallaxY
      );
      drawGravitationalLensingHorizon(horizonX, horizonY, effectiveTilt);

      ctx.restore();

      animationFrameId = window.requestAnimationFrame(render);
    };

    animationFrameId = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      window.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('mouseleave', handlePointerLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`astral-horizon-canvas ${className}`.trim()}
    />
  );
};

export default AstralHorizonCanvas;
```
