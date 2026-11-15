import { describe, expect, it } from 'vitest'
import {
  fitsImageHeader,
  formatDec,
  formatRA,
  mjdNow,
  planck,
} from './astronomy'
function fitsBuffer(cards: string[]) {
  return new TextEncoder().encode(
    cards
      .map((card) => card.padEnd(80))
      .join('')
      .padEnd(2880),
  ).buffer
}
describe('Astronomical readouts and actual FITS headers', () => {
  it('uses UTC MJD and wraps RA at the celestial meridian', () => {
    expect(mjdNow(Date.UTC(2000, 0, 1, 12))).toBe(51544.5)
    expect(formatRA(360)).toBe('00h 00m 00s')
    expect(formatRA(15)).toBe('01h 00m 00s')
    expect(formatDec(-7.25)).toBe('−07° 15′ 00″')
  })
  it('finds the actual IMAGE extension after an empty primary HDU', () => {
    const primary = fitsBuffer([
      'SIMPLE  =                    T',
      'NAXIS   =                    0',
      'END',
    ])
    const image = fitsBuffer([
      "XTENSION= 'IMAGE   '",
      'CRVAL1  =               133.79',
      "CTYPE1  = 'RA---TAN'",
      'END',
    ])
    const bytes = new Uint8Array(5760)
    bytes.set(new Uint8Array(primary))
    bytes.set(new Uint8Array(image), 2880)
    expect(fitsImageHeader(bytes.buffer)).toContain(
      'CRVAL1  =               133.79',
    )
  })
  it('rejects missing IMAGE metadata instead of inventing WCS cards', () => {
    expect(() =>
      fitsImageHeader(
        fitsBuffer([
          'SIMPLE  =                    T',
          'NAXIS   =                    0',
          'END',
        ]),
      ),
    ).toThrow('IMAGE header')
  })
  it('keeps cold-body model values finite throughout the selectable range', () => {
    for (const temperature of [100, 250, 2500])
      for (const wavelength of [0.75, 3.3, 5]) {
        expect(Number.isFinite(planck(wavelength, temperature))).toBe(true)
        expect(planck(wavelength, temperature)).toBeGreaterThan(0)
      }
  })
})
