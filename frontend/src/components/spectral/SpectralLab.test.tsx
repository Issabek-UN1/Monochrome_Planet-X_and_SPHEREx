import { afterEach, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SpectralLab } from './SpectralLab'
afterEach(cleanup)
it('labels model output honestly and supports molecule and detector controls', () => {
  render(<SpectralLab />)
  fireEvent.click(screen.getByText('ILLUSTRATIVE MODELS / REFERENCE ONLY'))
  expect(screen.getByText('ILLUSTRATIVE MODELS')).toBeTruthy()
  expect(screen.getByText('NO CLASSIFICATION INFERRED')).toBeTruthy()
  const methane = screen.getByRole('button', { name: /Methane reference/ })
  expect(methane.getAttribute('aria-pressed')).toBe('true')
  fireEvent.click(methane)
  expect(methane.getAttribute('aria-pressed')).toBe('false')
  fireEvent.click(screen.getByRole('button', { name: /DETECTOR 06/ }))
  expect(
    (screen.getByLabelText('Reference wavelength') as HTMLInputElement).value,
  ).toBe('4.71')
  expect(screen.getByText('REFERENCE BIN 095 / 102')).toBeTruthy()
  expect(screen.queryByText(/Methane Dominant/)).toBeNull()
})
