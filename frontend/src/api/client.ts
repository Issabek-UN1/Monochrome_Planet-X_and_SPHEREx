import { createSpherexClient, type TestTarget } from '@monochrome-spherex/api-client'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

export const spherexApi = createSpherexClient(API_BASE_URL)

// Curated metadata and real astronomical context for the 5 challenge targets
export interface EnhancedTarget extends TestTarget {
  category: 'Planet X Analogue' | 'High Proper Motion' | 'Sub-stellar Brown Dwarf' | 'Variable Star' | 'Pulsating Giant'
  description: string
  apparentMotion: string
  distanceLy: string
  temperatureK: string
  spherexRelevance: string
  imageUrlEpoch1: string
  imageUrlEpoch2: string
  differenceUrl: string
  blinkGifUrl: string
}

export const CURATED_TARGETS: EnhancedTarget[] = [
  {
    id: 'wise-0855',
    name: 'WISE 0855-0714',
    ra: 133.7951,
    dec: -7.2451,
    radius_deg: 0.15,
    fov_deg: 0.3,
    coordinate_source: 'https://www.spaceappschallenge.org/2026/challenges/planet-x-and-spherex/',
    notes: 'Coordinates supplied in the challenge. Sub-stellar candidate.',
    category: 'Planet X Analogue',
    description: 'The coldest known sub-stellar brown dwarf (~250 K / -23 °C). An ideal infrared proxy for detecting a cold, distant Planet X.',
    apparentMotion: '8.13 arcsec/year',
    distanceLy: '7.53 LY',
    temperatureK: '250 K',
    spherexRelevance: 'Completely dark in optical light; flares brightly in SPHEREx thermal infrared bands (3.5–5.0 µm).',
    imageUrlEpoch1: '/targets/wise-0855/epoch1.png',
    imageUrlEpoch2: '/targets/wise-0855/epoch2.png',
    differenceUrl: '/targets/wise-0855/difference.png',
    blinkGifUrl: '/targets/wise-0855/blink.gif',
  },
  {
    id: 'barnards-star',
    name: "Barnard's Star",
    ra: 269.4520769586,
    dec: 4.6933649666,
    radius_deg: 0.15,
    fov_deg: 0.3,
    coordinate_source: 'https://simbad.cds.unistra.fr/simbad/sim-id?Ident=Barnard%27s+star',
    notes: 'Reference field centre for fastest moving star across Earth night sky.',
    category: 'High Proper Motion',
    description: 'Fastest moving star in Earth’s sky. Moves 10.3 arcsec per year, providing the ultimate benchmark for multi-epoch change detection.',
    apparentMotion: '10.37 arcsec/year',
    distanceLy: '5.96 LY',
    temperatureK: '3,134 K',
    spherexRelevance: 'Shifts by over 5 arcsec between consecutive SPHEREx 6-month survey epochs.',
    imageUrlEpoch1: '/targets/barnards-star/epoch1.png',
    imageUrlEpoch2: '/targets/barnards-star/epoch2.png',
    differenceUrl: '/targets/barnards-star/difference.png',
    blinkGifUrl: '/targets/barnards-star/blink.gif',
  },
  {
    id: 'epsilon-indi-b',
    name: 'Epsilon Indi Ba/Bb',
    ra: 331.0441465885,
    dec: -56.7828441951,
    radius_deg: 0.15,
    fov_deg: 0.3,
    coordinate_source: 'https://simbad.cds.unistra.fr/simbad/sim-id?Ident=eps+Ind+B',
    notes: 'Binary brown dwarf system near the solar neighborhood.',
    category: 'Sub-stellar Brown Dwarf',
    description: 'One of the closest methane-rich T-type brown dwarf binaries, testing atmospheric methane absorption bands in SPHEREx spectra.',
    apparentMotion: '4.70 arcsec/year',
    distanceLy: '11.83 LY',
    temperatureK: '950 K',
    spherexRelevance: 'Strong absorption features at 1.6 µm and 3.3 µm mapped across SPHEREx spectral channels.',
    imageUrlEpoch1: '/targets/epsilon-indi-b/epoch1.png',
    imageUrlEpoch2: '/targets/epsilon-indi-b/epoch2.png',
    differenceUrl: '/targets/epsilon-indi-b/difference.png',
    blinkGifUrl: '/targets/epsilon-indi-b/blink.gif',
  },
  {
    id: 'rw-aurigae',
    name: 'RW Aurigae',
    ra: 76.9565260346,
    dec: 30.4014381739,
    radius_deg: 0.15,
    fov_deg: 0.3,
    coordinate_source: 'https://simbad.cds.unistra.fr/simbad/sim-id?Ident=RW+Aur',
    notes: 'Young stellar object with tidal arms and protoplanetary disk obscuration.',
    category: 'Variable Star',
    description: 'A young binary star with deep multi-magnitude dimming events caused by tidal disruption of its circumstellar planet-forming disk.',
    apparentMotion: '0.02 arcsec/year',
    distanceLy: '530 LY',
    temperatureK: '5,000 K',
    spherexRelevance: 'Infrared variability tracker: detects moving dust clumps and disk grains.',
    imageUrlEpoch1: '/targets/rw-aurigae/epoch1.png',
    imageUrlEpoch2: '/targets/rw-aurigae/epoch2.png',
    differenceUrl: '/targets/rw-aurigae/difference.png',
    blinkGifUrl: '/targets/rw-aurigae/blink.gif',
  },
  {
    id: 'r-draconis',
    name: 'R Draconis',
    ra: 248.1676108330,
    dec: 66.7549794172,
    radius_deg: 0.15,
    fov_deg: 0.3,
    coordinate_source: 'https://simbad.cds.unistra.fr/simbad/sim-id?Ident=R+Dra',
    notes: 'Long-period pulsating red giant with circum-stellar dust emission.',
    category: 'Pulsating Giant',
    description: 'Mira-type variable pulsating with a 245-day period, surrounded by expanding shells of silicate and ice particles.',
    apparentMotion: '0.015 arcsec/year',
    distanceLy: '2,100 LY',
    temperatureK: '2,800 K',
    spherexRelevance: 'SPHEREx tracks cyclical brightness variations across its 102 infrared bands.',
    imageUrlEpoch1: '/targets/r-draconis/epoch1.png',
    imageUrlEpoch2: '/targets/r-draconis/epoch2.png',
    differenceUrl: '/targets/r-draconis/difference.png',
    blinkGifUrl: '/targets/r-draconis/blink.gif',
  },
]
