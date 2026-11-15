import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { Job, SearchResult } from '@monochrome-spherex/api-client'
import { ApertureModal } from './ApertureModal'
import { usePipeline } from '../../hooks/usePipeline'
import { CURATED_TARGETS, spherexApi } from '../../api/client'
vi.mock('../../api/client', async (original) => ({
  ...(await original<typeof import('../../api/client')>()),
  spherexApi: {
    search: vi.fn(),
    createJob: vi.fn(),
    getJob: vi.fn(),
    artifactUrl: (a: { url: string }) => a.url,
  },
}))
function Harness() {
  const pipeline = usePipeline()
  return <ApertureModal target={CURATED_TARGETS[0]} pipeline={pipeline} />
}
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})
it('builds the selected chronological pair and displays only API artifacts', async () => {
  const target = CURATED_TARGETS[0]
  const result: SearchResult = {
    query: {
      source: 'spherex',
      ra: target.ra,
      dec: target.dec,
      radius_deg: 0.001,
      limit: 100,
    },
    observations: [
      {
        id: 'later',
        provider: 'irsa',
        collection: 'spherex_dr1',
        obs_id: 'exposure-later',
        detector: 1,
        mjd_start: 62000,
        synthetic: false,
      },
      {
        id: 'earlier',
        provider: 'irsa',
        collection: 'spherex_dr1',
        obs_id: 'exposure-earlier',
        detector: 1,
        mjd_start: 61000,
        synthetic: false,
      },
    ],
    possibly_truncated: false,
    cached: false,
    warnings: [],
  }
  vi.mocked(spherexApi.search).mockResolvedValue(result)
  const job: Job = {
    id: 'real-job',
    created_at: 1,
    updated_at: 1,
    attempts: 0,
    status: 'queued',
    request: {
      source: 'spherex',
      kind: 'blink',
      observation_ids: ['earlier', 'later'],
      ra: target.ra,
      dec: target.dec,
      fov_deg: target.fov_deg,
      size_px: 256,
      reject_flags: 4292870143,
      subtract_zodi: true,
    },
    artifacts: [],
    warnings: [],
  }
  vi.mocked(spherexApi.createJob).mockResolvedValue(job)
  vi.mocked(spherexApi.getJob).mockResolvedValue({
    ...job,
    status: 'succeeded',
    artifacts: [
      {
        name: 'frame-00.png',
        media_type: 'image/png',
        url: '/api/actual/reference.png',
      },
      {
        name: 'frame-01.png',
        media_type: 'image/png',
        url: '/api/actual/science.png',
      },
      {
        name: 'provenance.json',
        media_type: 'application/json',
        url: '/api/actual/provenance.json',
      },
    ],
  })
  render(<Harness />)
  expect(screen.queryByRole('img')).toBeNull()
  fireEvent.click(
    screen.getByRole('button', { name: /LOAD TARGET OBSERVATIONS/ }),
  )
  await screen.findByText('1000.00')
  fireEvent.click(screen.getByRole('button', { name: /BUILD COMPARISON/ }))
  const image = await screen.findByRole('img', {
    name: 'Earlier reference epoch',
  })
  expect(image.getAttribute('src')).toBe('/api/actual/reference.png')
  expect(
    vi.mocked(spherexApi.createJob).mock.calls[0][0].observation_ids,
  ).toEqual(['earlier', 'later'])
  const wipe = screen.getByRole('slider', { name: 'Epoch split position' })
  fireEvent.change(wipe, { target: { value: '70' } })
  expect((wipe as HTMLInputElement).value).toBe('70')
  expect(
    screen.getByRole('link', { name: 'provenance.json' }).getAttribute('href'),
  ).toBe('/api/actual/provenance.json')
  fireEvent.click(screen.getByRole('button', { name: /^Blink$/ }))
  expect(screen.getByRole('button', { name: /START BLINK/ })).toBeTruthy()
})
