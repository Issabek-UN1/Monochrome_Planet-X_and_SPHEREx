import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { App } from './App'
import { spherexApi } from './api/client'
vi.mock('./components/3d/CelestialSphereCanvas', () => ({
  CelestialSphereCanvas: () => <div>ICRS test canvas</div>,
}))
vi.mock('./api/client', async (original) => ({
  ...(await original<typeof import('./api/client')>()),
  spherexApi: {
    capabilities: vi.fn(),
    search: vi.fn(),
    createJob: vi.fn(),
    getJob: vi.fn(),
    artifactUrl: (a: { url: string }) => a.url,
  },
}))
beforeEach(() => {
  window.history.replaceState(null, '', '/')
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
    configurable: true,
    value: vi.fn(),
  })
  vi.mocked(spherexApi.capabilities).mockRejectedValue(new Error('offline'))
})
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})
it('navigates all four workspaces without substituting archive images', async () => {
  render(<App />)
  await screen.findByText('ICRS test canvas')
  expect(
    screen
      .getByRole('button', { name: 'Enable sound effects' })
      .getAttribute('aria-pressed'),
  ).toBe('false')
  fireEvent.click(screen.getByRole('button', { name: /Target comparator/ }))
  await screen.findByText('ESTABLISH A TEMPORAL BASELINE')
  expect(screen.queryByRole('img')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /Spectral lab/ }))
  await screen.findByText('ILLUSTRATIVE MODELS')
  fireEvent.click(screen.getByRole('button', { name: /Live explorer/ }))
  await screen.findByText('Signal acquisition')
  await waitFor(() => expect(window.location.hash).toBe('#explorer'))
  expect(screen.getByText('API UNAVAILABLE')).toBeTruthy()
  expect(spherexApi.search).not.toHaveBeenCalled()
})
it('restores URL coordinates and keeps them across workspace navigation', async () => {
  window.history.replaceState(null, '', '/?ra=10&dec=-20#explorer')
  render(<App />)
  expect(
    (screen.getByLabelText(/Right ascension/) as HTMLInputElement).value,
  ).toBe('10')
  expect((screen.getByLabelText(/Declination/) as HTMLInputElement).value).toBe(
    '-20',
  )
  fireEvent.click(screen.getByRole('button', { name: /Orbital vault/ }))
  await screen.findByText('ICRS test canvas')
  expect(window.location.search).toContain('dec=-20')
})
