type Tone = 'select' | 'hover' | 'aperture' | 'scrub'
let context: AudioContext | null = null
let enabled = false
let last = 0
export function setAudioEnabled(value: boolean) {
  enabled = value
  if (value) {
    try {
      context ??= new AudioContext()
      void context.resume().catch(() => {
        enabled = false
      })
    } catch {
      enabled = false
    }
  } else if (context?.state === 'running') void context.suspend()
  return enabled
}
export function playTone(tone: Tone) {
  if (!enabled || !context || context.state !== 'running') return
  const now = context.currentTime
  if (now - last < 0.07) return
  last = now
  const oscillator = context.createOscillator(),
    gain = context.createGain()
  const frequencies = {
    select: [80, 50],
    hover: [1200, 2400],
    aperture: [220, 65],
    scrub: [100, 45],
  }
  const [start, end] = frequencies[tone]
  const duration = tone === 'aperture' ? 0.18 : tone === 'hover' ? 0.04 : 0.08
  oscillator.type = tone === 'select' ? 'triangle' : 'sine'
  oscillator.frequency.setValueAtTime(start, now)
  oscillator.frequency.exponentialRampToValueAtTime(end, now + duration)
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.025, now + 0.006)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start(now)
  oscillator.stop(now + duration + 0.01)
  oscillator.onended = () => {
    oscillator.disconnect()
    gain.disconnect()
  }
}
