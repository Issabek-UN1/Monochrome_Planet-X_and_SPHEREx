export function mjdNow(time = Date.now()) {
  return time / 86400000 + 40587
}
export function formatRA(degrees: number) {
  const seconds = Math.floor((((degrees % 360) + 360) % 360) * 240)
  return `${String(Math.floor(seconds / 3600)).padStart(2, '0')}h ${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}m ${String(seconds % 60).padStart(2, '0')}s`
}
export function formatDec(degrees: number) {
  const seconds = Math.floor(Math.abs(degrees) * 3600)
  return `${degrees < 0 ? '−' : '+'}${String(Math.floor(seconds / 3600)).padStart(2, '0')}° ${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}′ ${String(seconds % 60).padStart(2, '0')}″`
}
export const DETECTORS = [
  { id: 1, lo: 0.75, hi: 1.09 },
  { id: 2, lo: 1.1, hi: 1.62 },
  { id: 3, lo: 1.63, hi: 2.41 },
  { id: 4, lo: 2.42, hi: 3.82 },
  { id: 5, lo: 3.83, hi: 4.41 },
  { id: 6, lo: 4.42, hi: 5.0 },
]
export function planck(wavelengthUm: number, temperature: number) {
  return (
    1 /
    (Math.pow(wavelengthUm, 5) *
      Math.expm1(14387.76877 / (wavelengthUm * temperature)))
  )
}
export function fitsImageHeader(buffer: ArrayBuffer) {
  const text = new TextDecoder('ascii').decode(buffer)
  let offset = 0
  for (let hdu = 0; hdu < 3 && offset < text.length; hdu++) {
    const cards: string[] = []
    let ended = false
    for (let index = offset; index + 80 <= text.length; index += 80) {
      const card = text.slice(index, index + 80)
      cards.push(card.trimEnd())
      if (card.slice(0, 8).trim() === 'END') {
        offset = Math.ceil((index + 80) / 2880) * 2880
        ended = true
        break
      }
    }
    if (!ended) break
    if (
      cards.some(
        (card) => card.startsWith('XTENSION') && card.includes('IMAGE'),
      )
    )
      return cards
    // Backend products have an empty primary HDU followed by the IMAGE extension.
    if (!cards.some((card) => /^NAXIS\s*=\s*0(?:\s|\/|$)/.test(card))) break
  }
  throw new Error('IMAGE header is unavailable in this FITS product')
}
