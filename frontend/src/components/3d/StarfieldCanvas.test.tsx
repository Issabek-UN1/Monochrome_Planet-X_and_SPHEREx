import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { StarfieldCanvas } from './StarfieldCanvas'

describe('StarfieldCanvas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders canvas element with starfield container', () => {
    const { container } = render(<StarfieldCanvas scrollY={100} />)
    const canvas = container.querySelector('canvas.starfield-canvas')
    expect(canvas).toBeTruthy()
    const wrapper = container.querySelector('.starfield-container')
    expect(wrapper).toBeTruthy()
  })

  it('updates when scrollY prop changes', () => {
    const { rerender, container } = render(<StarfieldCanvas scrollY={0} />)
    rerender(<StarfieldCanvas scrollY={500} />)
    const canvas = container.querySelector('canvas.starfield-canvas')
    expect(canvas).toBeTruthy()
  })
})
