import {
  createSpherexClient,
  type TestTarget,
} from '@monochrome-spherex/api-client'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

export const spherexApi = createSpherexClient(API_BASE_URL)

// Curated metadata and real astronomical context for the 5 challenge targets
export interface EnhancedTarget extends TestTarget {
  category:
    | 'Custom Field'
    | 'Planet X Analogue'
    | 'High Proper Motion'
    | 'Sub-stellar Brown Dwarf'
    | 'Variable Star'
    | 'Pulsating Giant'
  description: string
}

export const CURATED_TARGETS: EnhancedTarget[] = [
  {
    id: 'wise-0855',
    name: 'WISE 0855-0714',
    ra: 133.7951,
    dec: -7.2451,
    radius_deg: 0.15,
    fov_deg: 0.3,
    coordinate_source:
      'https://www.spaceappschallenge.org/2026/challenges/planet-x-and-spherex/',
    notes: 'Coordinates supplied in the challenge. Sub-stellar candidate.',
    category: 'Planet X Analogue',
    description:
      'The coldest known sub-stellar brown dwarf (~250 K / -23 °C). An ideal infrared proxy for detecting a cold, distant Planet X.',
  },
  {
    id: 'barnards-star',
    name: "Barnard's Star",
    ra: 269.4520769586,
    dec: 4.6933649666,
    radius_deg: 0.15,
    fov_deg: 0.3,
    coordinate_source:
      'https://simbad.cds.unistra.fr/simbad/sim-id?Ident=Barnard%27s+star',
    notes:
      'Reference field centre for fastest moving star across Earth night sky.',
    category: 'High Proper Motion',
    description:
      'Fastest moving star in Earth’s sky. Moves 10.3 arcsec per year, providing the ultimate benchmark for multi-epoch change detection.',
  },
  {
    id: 'epsilon-indi-b',
    name: 'Epsilon Indi Ba/Bb',
    ra: 331.0441465885,
    dec: -56.7828441951,
    radius_deg: 0.15,
    fov_deg: 0.3,
    coordinate_source:
      'https://simbad.cds.unistra.fr/simbad/sim-id?Ident=eps+Ind+B',
    notes: 'Binary brown dwarf system near the solar neighborhood.',
    category: 'Sub-stellar Brown Dwarf',
    description:
      'One of the closest methane-rich T-type brown dwarf binaries, testing atmospheric methane absorption bands in SPHEREx spectra.',
  },
  {
    id: 'rw-aurigae',
    name: 'RW Aurigae',
    ra: 76.9565260346,
    dec: 30.4014381739,
    radius_deg: 0.15,
    fov_deg: 0.3,
    coordinate_source:
      'https://simbad.cds.unistra.fr/simbad/sim-id?Ident=RW+Aur',
    notes:
      'Young stellar object with tidal arms and protoplanetary disk obscuration.',
    category: 'Variable Star',
    description:
      'A young binary star with deep multi-magnitude dimming events caused by tidal disruption of its circumstellar planet-forming disk.',
  },
  {
    id: 'r-draconis',
    name: 'R Draconis',
    ra: 248.167610833,
    dec: 66.7549794172,
    radius_deg: 0.15,
    fov_deg: 0.3,
    coordinate_source:
      'https://simbad.cds.unistra.fr/simbad/sim-id?Ident=R+Dra',
    notes: 'Long-period pulsating red giant with circum-stellar dust emission.',
    category: 'Pulsating Giant',
    description:
      'Mira-type variable pulsating with a 245-day period, surrounded by expanding shells of silicate and ice particles.',
  },
]
