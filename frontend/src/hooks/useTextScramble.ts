import { useEffect, useState } from 'react'

const GLYPHS = '0123456789ABCDEF$#@*+~/%=<>{}[]'

export function useTextScramble(finalText: string, durationMs = 450) {
  const [displayText, setDisplayText] = useState(finalText)

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let frame = 0
    const totalFrames = Math.max(8, Math.floor(durationMs / 30))
    const length = finalText.length

    const interval = setInterval(() => {
      frame++
      const progress = frame / totalFrames

      if (progress >= 1) {
        setDisplayText(finalText)
        clearInterval(interval)
        return
      }

      const revealedChars = Math.floor(progress * length)
      let scrambled = ''

      for (let i = 0; i < length; i++) {
        if (finalText[i] === ' ') {
          scrambled += ' '
        } else if (i < revealedChars) {
          scrambled += finalText[i]
        } else {
          scrambled += GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
        }
      }

      setDisplayText(scrambled)
    }, 30)

    return () => clearInterval(interval)
  }, [finalText, durationMs])

  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ? finalText
    : displayText
}
