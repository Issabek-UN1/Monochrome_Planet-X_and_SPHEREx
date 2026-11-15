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
vi.mock('./components/3d/StarfieldCanvas', () => ({
  StarfieldCanvas: () => <div>Decorative starfield</div>,
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
  window.scrollY = 0
  Object.defineProperty(window, 'scrollTo', { configurable: true, value: vi.fn() })
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

it('starts with minimal header at scrollY 0 in vault mode and reveals tabs on scroll', async () => {
  render(<App />)
  await screen.findByText('ICRS test canvas')

  const nav = screen.getByLabelText('Mission modes')
  expect(nav.classList.contains('mode-nav-hidden')).toBe(true)

  // Simulate scroll past hero
  window.scrollY = 250
  fireEvent.scroll(window)

  await waitFor(() => {
    expect(nav.classList.contains('mode-nav-visible')).toBe(true)
  })
})

it('triggers smooth scroll to Section 2 when clicking EXPLORE ARCHIVE button', async () => {
  render(<App />)
  await screen.findByText('ICRS test canvas')

  const section2 = document.getElementById('vault-directory-section')
  expect(section2).toBeTruthy()

  const scrollIntoViewMock = vi.fn()
  if (section2) {
    section2.scrollIntoView = scrollIntoViewMock
  }

  const exploreBtn = screen.getByRole('button', {
    name: /EXPLORE ARCHIVE/i,
  })
  fireEvent.click(exploreBtn)

  expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth' })
})

it('restores field size and archive detector from a shareable URL', async () => {
  window.history.replaceState(
    null,
    '',
    '/?ra=10&dec=-20&fov=0.08&band=SPHEREx-D4#explorer',
  )
  vi.mocked(spherexApi.search).mockImplementation(async (query) => ({
    query,
    observations: [],
    possibly_truncated: false,
    cached: false,
    warnings: [],
  }))
  render(<App />)
  expect((screen.getByLabelText(/Image field/) as HTMLInputElement).value).toBe(
    '0.08',
  )
  expect(
    (screen.getByLabelText('Archive detector') as HTMLSelectElement).value,
  ).toBe('4')
  fireEvent.click(screen.getByRole('button', { name: /QUERY.*OBSERVATIONS/ }))
  await waitFor(() =>
    expect(spherexApi.search).toHaveBeenCalledWith(
      expect.objectContaining({ ra: 10, dec: -20, detector: 4 }),
      expect.any(AbortSignal),
    ),
  )
  fireEvent.click(screen.getByRole('button', { name: /Orbital vault/ }))
  await screen.findByText('ICRS test canvas')
  expect(new URLSearchParams(window.location.search).get('fov')).toBe('0.08')
  expect(new URLSearchParams(window.location.search).get('band')).toBe(
    'SPHEREx-D4',
  )
})

it('keeps NEOSSat selected after quick pointing and a workspace round trip', async () => {
  window.history.replaceState(null, '', '/#explorer')
  vi.mocked(spherexApi.search).mockImplementation(async (query) => ({
    query,
    observations: [],
    possibly_truncated: false,
    cached: false,
    warnings: [],
  }))
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: /NEOSSat CADC/ }))
  fireEvent.click(screen.getByRole('button', { name: "Barnard's Star" }))
  await waitFor(() =>
    expect(spherexApi.search).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'neossat', ra: 269.4520769586 }),
      expect.any(AbortSignal),
    ),
  )
  expect(
    screen
      .getByRole('button', { name: /NEOSSat CADC/ })
      .getAttribute('aria-pressed'),
  ).toBe('true')
  fireEvent.click(screen.getByRole('button', { name: /Orbital vault/ }))
  await screen.findByText('ICRS test canvas')
  fireEvent.click(screen.getByRole('button', { name: /Live explorer/ }))
  expect(
    screen
      .getByRole('button', { name: /NEOSSat CADC/ })
      .getAttribute('aria-pressed'),
  ).toBe('true')
})

it('shares manually searched coordinates and uses them in the comparator', async () => {
  window.history.replaceState(null, '', '/#explorer')
  vi.mocked(spherexApi.search).mockImplementation(async (query) => ({
    query,
    observations: [],
    possibly_truncated: false,
    cached: false,
    warnings: [],
  }))
  render(<App />)
  fireEvent.change(screen.getByLabelText(/Right ascension/), {
    target: { value: '42' },
  })
  fireEvent.change(screen.getByLabelText(/Declination/), {
    target: { value: '-12' },
  })
  fireEvent.click(screen.getByRole('button', { name: /QUERY.*OBSERVATIONS/ }))
  await waitFor(() =>
    expect(new URLSearchParams(window.location.search).get('ra')).toBe('42'),
  )
  fireEvent.click(screen.getByRole('button', { name: /Target comparator/ }))
  await screen.findByText('42.00000° / -12.00000°')
})
