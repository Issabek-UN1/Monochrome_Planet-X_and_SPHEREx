import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  Job,
  JobRequest,
  SearchResult,
  SkySearch,
} from '@monochrome-spherex/api-client'
import { spherexApi } from '../api/client'
export interface PipelineEvent {
  time: string
  text: string
}
export function usePipeline() {
  const [result, setResult] = useState<SearchResult | null>(null)
  const [job, setJob] = useState<Job | null>(null)
  const [completed, setCompleted] = useState<Job[]>([])
  const [events, setEvents] = useState<PipelineEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const abort = useRef<AbortController | null>(null)
  const [pollRevision, setPollRevision] = useState(0)
  const log = useCallback(
    (text: string) =>
      setEvents((old) => [
        ...old.slice(-39),
        { time: new Date().toISOString().slice(11, 19), text },
      ]),
    [],
  )
  const reset = useCallback(() => {
    abort.current?.abort()
    setResult(null)
    setJob(null)
    setCompleted([])
    setError(null)
    setEvents([])
    setBusy(false)
  }, [])
  useEffect(() => () => abort.current?.abort(), [])
  const load = useCallback(
    async (query: SkySearch) => {
      abort.current?.abort()
      const controller = new AbortController()
      abort.current = controller
      setBusy(true)
      setError(null)
      setResult(null)
      setJob(null)
      setCompleted([])
      log(
        `SEARCH ${query.source.toUpperCase()} · ICRS ${query.ra.toFixed(5)}, ${query.dec.toFixed(5)}`,
      )
      try {
        const response = await spherexApi.search(query, controller.signal)
        if (controller.signal.aborted) return
        setResult(response)
        log(
          `RECEIVED ${response.observations.length} observations${response.cached ? ' · cached' : ''}`,
        )
      } catch (failure) {
        if (!controller.signal.aborted) {
          const message =
            failure instanceof Error
              ? failure.message
              : 'Archive request failed'
          setError(message)
          log(`ERROR ${message}`)
        }
      } finally {
        if (!controller.signal.aborted) setBusy(false)
      }
    },
    [log],
  )
  const run = useCallback(
    async (
      kind: JobRequest['kind'],
      ids: string[],
      fov: number,
      size = 256,
    ) => {
      if (!result) return
      const source = result.query.source
      if (
        ids.length > 12 ||
        !ids.length ||
        (kind === 'cutout' && ids.length !== 1) ||
        (kind === 'difference' && ids.length !== 2) ||
        (['blink', 'stack'].includes(kind) && ids.length < 2)
      ) {
        setError(
          'Choose 1 frame for cutout, 2 for difference, or 2–12 for blink/stack.',
        )
        return
      }
      if (source === 'neossat' && ['stack', 'difference'].includes(kind)) {
        setError('NEOSSat supports cutout and blink only.')
        return
      }
      abort.current?.abort()
      const controller = new AbortController()
      abort.current = controller
      setBusy(true)
      setError(null)
      setJob(null)
      log(`DISPATCH ${kind.toUpperCase()} · ${ids.length} frames`)
      try {
        const response = await spherexApi.createJob(
          {
            source,
            kind,
            observation_ids: ids,
            ra: result.query.ra,
            dec: result.query.dec,
            fov_deg: fov,
            size_px: size,
            subtract_zodi: source !== 'neossat',
            reject_flags: source === 'neossat' ? 0 : 4292870143,
          },
          controller.signal,
        )
        if (!controller.signal.aborted) {
          setJob(response)
          log(`QUEUED ${response.id.slice(0, 12)}`)
        }
      } catch (failure) {
        if (!controller.signal.aborted) {
          const message =
            failure instanceof Error ? failure.message : 'Dispatch failed'
          setError(message)
          setBusy(false)
          log(`ERROR ${message}`)
        }
      }
    },
    [result, log],
  )
  const jobId = job?.id
  useEffect(() => {
    if (!jobId) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    let previous = '',
      attempts = 0
    const poll = async () => {
      try {
        const response = await spherexApi.getJob(jobId, controller.signal)
        if (controller.signal.aborted) return
        setJob(response)
        if (response.status !== previous) {
          log(`${response.status.toUpperCase()} ${jobId.slice(0, 12)}`)
          previous = response.status
        }
        if (response.status === 'succeeded') {
          setCompleted((old) =>
            [...old.filter((item) => item.id !== response.id), response].slice(
              -8,
            ),
          )
          setBusy(false)
          return
        }
        if (response.status === 'failed') {
          setError(response.error || 'Processing failed')
          setBusy(false)
          return
        }
        if (++attempts >= 450)
          throw new Error(
            'Still processing after 15 minutes. Check the worker, then resume polling; the job is saved.',
          )
        timer = setTimeout(poll, 2000)
      } catch (failure) {
        if (!controller.signal.aborted) {
          setError(
            failure instanceof Error ? failure.message : 'Polling failed',
          )
          setBusy(false)
        }
      }
    }
    void poll()
    return () => {
      controller.abort()
      if (timer) clearTimeout(timer)
    }
  }, [jobId, log, pollRevision])
  return {
    result,
    job,
    completed,
    events,
    error,
    busy,
    load,
    run,
    reset,
    resume: () => {
      setError(null)
      setBusy(true)
      setPollRevision((old) => old + 1)
    },
  }
}
export type Pipeline = ReturnType<typeof usePipeline>
