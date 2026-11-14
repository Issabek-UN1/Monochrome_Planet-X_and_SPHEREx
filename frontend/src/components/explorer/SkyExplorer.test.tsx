import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Job, SearchResult } from '@monochrome-spherex/api-client'
import { SkyExplorer } from './SkyExplorer'
import { CURATED_TARGETS, spherexApi } from '../../api/client'

vi.mock('../../api/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../api/client')>()
  return { ...original, spherexApi: {
    search: vi.fn(), createJob: vi.fn(), getJob: vi.fn(),
    artifactUrl: (artifact: {url: string}) => artifact.url,
  } }
})

const result = {
  query: {source: 'spherex', ra: 10, dec: 20, radius_deg: 0.1, limit: 100},
  observations: ['a', 'b'].map((letter, index) => ({
    id: letter.repeat(24), provider: 'demo', synthetic: true, collection: 'synthetic',
    obs_id: `exposure-${index}`, detector: 1, mjd_start: 61000 + index * 90,
  })),
  possibly_truncated: false, cached: false, warnings: [],
} as SearchResult

async function search() {
  fireEvent.click(screen.getByRole('button', {name: /QUERY.*OBSERVATIONS/}))
  await screen.findByText('ID: aaaaaaaaaaaaaaaa...')
}

beforeEach(() => {
  vi.mocked(spherexApi.search).mockResolvedValue(result)
})
afterEach(() => { cleanup(); vi.resetAllMocks() })

describe('Sky Explorer request lifecycle', () => {
  it('shows archive failures without fabricated observations or success', async () => {
    vi.mocked(spherexApi.search).mockRejectedValue(new Error('Archive unavailable'))
    render(<SkyExplorer />)
    fireEvent.click(screen.getByRole('button', {name: /QUERY.*OBSERVATIONS/}))
    await screen.findByText('Archive unavailable')
    expect(screen.queryByText('ID: aaaaaaaaaaaaaaaa...')).toBeNull()
    expect(spherexApi.createJob).not.toHaveBeenCalled()
  })

  it('shows submission failures instead of manufacturing artifacts', async () => {
    vi.mocked(spherexApi.createJob).mockRejectedValue(new Error('Queue full'))
    render(<SkyExplorer />)
    await search()
    fireEvent.click(screen.getByRole('button', {name: /GENERATE BLINK/}))
    await screen.findByRole('alert')
    expect(screen.getByRole('alert').textContent).toContain('Queue full')
    expect(spherexApi.getJob).not.toHaveBeenCalled()
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('clears observations and unsupported operations when changing missions', async () => {
    render(<SkyExplorer />)
    await search()
    fireEvent.click(screen.getByRole('button', {name: /NEOSSat/}))
    await waitFor(() => expect(screen.queryByText('ID: aaaaaaaaaaaaaaaa...')).toBeNull())
    expect((screen.getByRole('button', {name: /DIFFERENCE/}) as HTMLButtonElement).disabled).toBe(true)
  })

  it('clears old observations when a different target is opened', async () => {
    const view = render(<SkyExplorer initialTarget={CURATED_TARGETS[0]} />)
    await search()
    view.rerender(<SkyExplorer initialTarget={CURATED_TARGETS[1]} />)
    await waitFor(() => expect(screen.queryByText('ID: aaaaaaaaaaaaaaaa...')).toBeNull())
  })

  it('ignores a late response after the mission has changed', async () => {
    let resolve!: (value: SearchResult) => void
    vi.mocked(spherexApi.search).mockReturnValue(new Promise(done => { resolve = done }))
    render(<SkyExplorer />)
    fireEvent.click(screen.getByRole('button', {name: /QUERY.*OBSERVATIONS/}))
    fireEvent.click(screen.getByRole('button', {name: /NEOSSat/}))
    await act(async () => { resolve(result) })
    expect(screen.queryByText('ID: aaaaaaaaaaaaaaaa...')).toBeNull()
  })

  it('uses searched coordinates for jobs and exposes worker failures', async () => {
    const job = {id: 'c'.repeat(32), status: 'queued', request: {source: 'spherex', kind: 'blink', observation_ids: ['a'.repeat(24), 'b'.repeat(24)], ra: 10, dec: 20, fov_deg: 0.1, size_px: 256, reject_flags: 4292870143, subtract_zodi: true},
      created_at: 1, updated_at: 1, attempts: 0, artifacts: [], warnings: []} as Job
    vi.mocked(spherexApi.createJob).mockResolvedValue(job)
    vi.mocked(spherexApi.getJob).mockResolvedValue({...job, status: 'failed', error: 'Processing failed'})
    render(<SkyExplorer />)
    await search()
    fireEvent.change(screen.getAllByRole('spinbutton')[0], {target: {value: '42'}})
    fireEvent.click(screen.getByRole('button', {name: /GENERATE BLINK/}))
    await screen.findByRole('alert')
    expect(vi.mocked(spherexApi.createJob).mock.calls[0][0]).toMatchObject({ra: 10, dec: 20})
    expect(screen.getByRole('alert').textContent).toContain('Processing failed')
  })
})
