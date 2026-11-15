export interface TargetEpochData {
  id: string
  name: string
  properMotion: string
  angularShift: string
  baseline: string
  spectralType: string
  notesEn: string
  notesRu: string
  epochA: {
    year: string
    catalog: string
    dx: number
    dy: number
    radius: number
    flux: number
    hasCompanion?: boolean
    companionOffset?: { dx: number; dy: number; radius: number; flux: number }
    diffractionSpikes?: boolean
    coronaRadius?: number
  }
  epochB: {
    year: string
    catalog: string
    dx: number
    dy: number
    radius: number
    flux: number
    hasCompanion?: boolean
    companionOffset?: { dx: number; dy: number; radius: number; flux: number }
    diffractionSpikes?: boolean
    coronaRadius?: number
  }
}

export const TARGET_EPOCH_DATA: Record<string, TargetEpochData> = {
  'wise-0855': {
    id: 'wise-0855',
    name: 'WISE J085510.83-071442.5',
    properMotion: '8.14 "/yr',
    angularShift: '120.5 "',
    baseline: '2010.4 → 2025.2 (14.8 YR)',
    spectralType: 'Y4 (Cold Brown Dwarf)',
    notesEn: 'Record sub-stellar proper motion displacement southeast across 14.8 years',
    notesRu: 'Рекордное собственное движение субзвёздного карлика на юго-восток за 14.8 лет',
    epochA: {
      year: '2010.4',
      catalog: 'WISE / IRSA',
      dx: -38,
      dy: 30,
      radius: 3.2,
      flux: 0.7,
      coronaRadius: 10,
    },
    epochB: {
      year: '2025.2',
      catalog: 'SPHEREx DR1',
      dx: 34,
      dy: -42,
      radius: 3.4,
      flux: 0.74,
      coronaRadius: 10,
    },
  },
  'barnards-star': {
    id: 'barnards-star',
    name: "Barnard's Star (GJ 699)",
    properMotion: '10.37 "/yr',
    angularShift: '103.7 "',
    baseline: '2015.0 → 2025.0 (10.0 YR)',
    spectralType: 'M4.0V (High-Velocity Dwarf)',
    notesEn: 'Highest known stellar proper motion benchmark in the celestial sphere',
    notesRu: 'Абсолютный рекорд собственного движения среди звёзд на небесной сфере',
    epochA: {
      year: '2015.0',
      catalog: 'NEOWISE Archive',
      dx: 2,
      dy: 48,
      radius: 4.8,
      flux: 0.95,
      diffractionSpikes: true,
      coronaRadius: 14,
    },
    epochB: {
      year: '2025.0',
      catalog: 'SPHEREx DR1',
      dx: -4,
      dy: -52,
      radius: 4.8,
      flux: 0.95,
      diffractionSpikes: true,
      coronaRadius: 14,
    },
  },
  'epsilon-indi-b': {
    id: 'epsilon-indi-b',
    name: 'Epsilon Indi Ba / Bb',
    properMotion: '4.70 "/yr',
    angularShift: '31.5 "',
    baseline: '2018.5 → 2025.2 (6.7 YR)',
    spectralType: 'T1 + T6 (Binary Brown Dwarf)',
    notesEn: 'Binary brown dwarf mutual orbital rotation combined with barycentric proper motion',
    notesRu: 'Орбитальное вращение пары коричневых карликов и общее собственное движение',
    epochA: {
      year: '2018.5',
      catalog: 'VLT / NACO',
      dx: -24,
      dy: -16,
      radius: 3.8,
      flux: 0.88,
      hasCompanion: true,
      companionOffset: { dx: -14, dy: -26, radius: 2.8, flux: 0.62 },
      coronaRadius: 12,
    },
    epochB: {
      year: '2025.2',
      catalog: 'SPHEREx DR1',
      dx: 12,
      dy: 14,
      radius: 3.8,
      flux: 0.88,
      hasCompanion: true,
      companionOffset: { dx: 26, dy: 8, radius: 2.8, flux: 0.62 },
      coronaRadius: 12,
    },
  },
  'rw-aurigae': {
    id: 'rw-aurigae',
    name: 'RW Aurigae A/B',
    properMotion: '0.02 "/yr',
    angularShift: '0.08 "',
    baseline: '2021.1 → 2025.1 (4.0 YR)',
    spectralType: 'K3:e (T Tauri Variable)',
    notesEn: 'Extreme photometric drop (>2 mag) caused by circumstellar accretion disk occultation',
    notesRu: 'Глубокое фотометрическое затмение (>2 зв. вел.) пылевым протопланетным диском',
    epochA: {
      year: '2021.1',
      catalog: 'HST / WFC3',
      dx: 0,
      dy: 0,
      radius: 6.0,
      flux: 1.0,
      diffractionSpikes: true,
      coronaRadius: 22,
    },
    epochB: {
      year: '2025.1',
      catalog: 'SPHEREx DR1',
      dx: 2,
      dy: 1,
      radius: 2.2,
      flux: 0.2,
      diffractionSpikes: false,
      coronaRadius: 6,
    },
  },
  'r-draconis': {
    id: 'r-draconis',
    name: 'R Draconis',
    properMotion: '0.03 "/yr',
    angularShift: '0.01 "',
    baseline: '2024.3 → 2024.7 (0.4 YR)',
    spectralType: 'M5e-M9e (Mira Variable Giant)',
    notesEn: 'Giant long-period Mira radial pulsation cycle between optical maximum and minimum',
    notesRu: 'Гигантская длиннопериодическая пульсация Мириды между максимумом и минимумом светимости',
    epochA: {
      year: '2024.3 (MAX)',
      catalog: 'AAVSO / IRSA',
      dx: 0,
      dy: 0,
      radius: 7.2,
      flux: 1.0,
      diffractionSpikes: true,
      coronaRadius: 26,
    },
    epochB: {
      year: '2024.7 (MIN)',
      catalog: 'SPHEREx DR1',
      dx: 0,
      dy: 0,
      radius: 2.6,
      flux: 0.22,
      diffractionSpikes: false,
      coronaRadius: 8,
    },
  },
}

export const DEFAULT_TARGET_EPOCH = TARGET_EPOCH_DATA['wise-0855']
