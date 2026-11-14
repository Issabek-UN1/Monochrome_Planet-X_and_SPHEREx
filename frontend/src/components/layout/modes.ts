import { Aperture, AudioLines, Orbit, ScanLine } from 'lucide-react'
export type Mode = 'vault' | 'comparator' | 'spectral' | 'explorer'
export const MODES = [
  { id: 'vault', label: 'Orbital vault', icon: Orbit },
  { id: 'comparator', label: 'Target comparator', icon: Aperture },
  { id: 'spectral', label: 'Spectral lab', icon: AudioLines },
  { id: 'explorer', label: 'Live explorer', icon: ScanLine },
] as const
