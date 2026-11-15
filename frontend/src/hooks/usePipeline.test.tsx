import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { Job, SearchResult } from '@monochrome-spherex/api-client'
import { usePipeline } from './usePipeline'
import { spherexApi } from '../api/client'

vi.mock('../api/client', () => ({
  spherexApi: {
    search: vi.fn(),
    createJob: vi.fn(),
    getJob: vi.fn(),
  },
}))

const search: SearchResult = {
  query: { source: 'spherex', ra: 10, dec: 20, radius_deg: 0.1, limit: 100 },
  observations: [
    {
      id: 'a'.repeat(24),
      provider: 'irsa',
      collection: 'spherex_dr1',
      obs_id: 'a',
      detector: 1,
      synthetic: false,
    },
  ],
  possibly_truncated: false,
  cached: false,
  warnings: [],
}
const queued: Job = {
  id: 'b'.repeat(32),
  status: 'queued',
  created_at: 1,
  updated_at: 1,
  attempts: 0,
  artifacts: [],
  warnings: [],
  request: {
    source: 'spherex',
    kind: 'cutout',
    observation_ids: ['a'.repeat(24)],
    ra: 10,
    dec: 20,
    fov_deg: 0.1,
    size_px: 256,
    reject_flags: 0,
    subtract_zodi: true,
  },
}

afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

it('immediately aborts an in-flight poll when a new search replaces the job', async () => {
  vi.mocked(spherexApi.search).mockResolvedValue(search)
  vi.mocked(spherexApi.createJob).mockResolvedValue(queued)
  let finish!: (value: Job) => void
  vi.mocked(spherexApi.getJob).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const { result } = renderHook(usePipeline)
  await act(() => result.current.load(search.query))
  await act(() => result.current.run('cutout', ['a'.repeat(24)], 0.1))
  await waitFor(() => expect(spherexApi.getJob).toHaveBeenCalledOnce())
  const signal = vi.mocked(spherexApi.getJob).mock.calls[0][1]!
  await act(async () => {
    const loading = result.current.load({ ...search.query, ra: 42 })
    expect(signal.aborted).toBe(true)
    finish({ ...queued, status: 'succeeded' })
    await loading
  })
  expect(result.current.job).toBeNull()
  expect(result.current.completed).toEqual([])
})

it('aborts polling synchronously on reset and ignores a late completion', async () => {
  vi.mocked(spherexApi.search).mockResolvedValue(search)
  vi.mocked(spherexApi.createJob).mockResolvedValue(queued)
  let finish!: (value: Job) => void
  vi.mocked(spherexApi.getJob).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const { result } = renderHook(usePipeline)
  await act(() => result.current.load(search.query))
  await act(() => result.current.run('cutout', ['a'.repeat(24)], 0.1))
  await waitFor(() => expect(spherexApi.getJob).toHaveBeenCalledOnce())
  const signal = vi.mocked(spherexApi.getJob).mock.calls[0][1]!
  await act(async () => {
    result.current.reset()
    expect(signal.aborted).toBe(true)
    finish({ ...queued, status: 'succeeded' })
  })
  expect(result.current.job).toBeNull()
  expect(result.current.busy).toBe(false)
  expect(result.current.events).toEqual([])
})
