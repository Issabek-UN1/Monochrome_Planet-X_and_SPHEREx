import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { Job, SpectrumResult } from '@monochrome-spherex/api-client'
import { MeasuredSpectrum } from './MeasuredSpectrum'
import { spherexApi } from '../../api/client'

vi.mock('../../api/client', () => ({ spherexApi: {
  createJob: vi.fn(), getJob: vi.fn(), getSpectrum: vi.fn(),
  artifactUrl: (artifact: { url: string }) => artifact.url,
} }))
afterEach(() => { cleanup(); vi.resetAllMocks() })

it('requires an explicit request and shows archive errors without substituting models', async () => {
  vi.mocked(spherexApi.createJob).mockRejectedValue(new Error('IRSA unavailable'))
  render(<MeasuredSpectrum />)
  expect(spherexApi.createJob).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'LOAD MEASURED DR1 SPECTRUM' }))
  expect((await screen.findByRole('alert')).textContent).toContain('IRSA unavailable')
  expect(screen.queryByRole('img')).toBeNull()
})

it('plots absolute archive values and keeps missing channels in the quality table', async () => {
  const job = { id: 'spectrum-job', status: 'queued', artifacts: [] } as unknown as Job
  vi.mocked(spherexApi.createJob).mockResolvedValue(job)
  vi.mocked(spherexApi.getJob).mockResolvedValue({ ...job, status: 'succeeded' })
  const data: SpectrumResult = {
    ra: 10, dec: 20, sampled_ra: 10, sampled_dec: 20, source_url: 'https://irsa.ipac.caltech.edu/example.fits',
    release: 'test-fixture', reject_flags: 4292870143, downloaded_bytes: 0, synthetic: false,
    method: 'nearest mosaic pixel', unit: 'MJy/sr', warnings: [],
    samples: Array.from({ length: 102 }, (_, index) => ({
      channel: index + 1, detector: Math.floor(index / 17) + 1, subchannel: index % 17 + 1,
      wavelength_um: .75 + index / 101 * 4.25,
      surface_brightness_mjy_sr: index === 50 || index === 51 ? null : index - 20,
      uncertainty_mjy_sr: null, nhits: index === 50 || index === 51 ? 0 : 3, flags: 0,
      usable: index !== 50 && index !== 51,
      exclusion_reason: index === 50 || index === 51 ? 'no_coverage' : null,
    })),
  }
  vi.mocked(spherexApi.getSpectrum).mockResolvedValue(data)
  render(<MeasuredSpectrum />)
  fireEvent.click(screen.getByRole('button', { name: 'LOAD MEASURED DR1 SPECTRUM' }))
  await screen.findByRole('img', { name: /Measured SPHEREx spectrum/ })
  expect(screen.getByRole('status').textContent).toContain('100 usable / 102 nominal channels')
  expect(screen.getAllByText('no_coverage')).toHaveLength(2)
  expect(screen.getByText('-20.000')).toBeTruthy()
  expect(vi.mocked(spherexApi.createJob).mock.calls[0][0]).toMatchObject({kind: 'spectrum', observation_ids: [], subtract_zodi: false})
})

it('aborts a submitted request when leaving the workspace', () => {
  vi.mocked(spherexApi.createJob).mockReturnValue(new Promise(() => {}))
  const view = render(<MeasuredSpectrum />)
  fireEvent.click(screen.getByRole('button', { name: 'LOAD MEASURED DR1 SPECTRUM' }))
  const signal = vi.mocked(spherexApi.createJob).mock.calls[0][1]!
  view.unmount()
  expect(signal.aborted).toBe(true)
})
