'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { submissionEventsUrl, submissionsApi, type Submission } from '../api/submissions.api';

export type Connection = 'connecting' | 'live' | 'reconnecting' | 'polling' | 'done' | 'error';

const POLL_MS = 2000;
/** EventSource reconnects by itself; after this many failures in a row we poll instead. */
const MAX_STREAM_FAILURES = 3;

/**
 * Follows one submission until it finishes (GRD-46, GRD-49).
 *
 * Prefers Server-Sent Events. A dropped connection is reconnected by the
 * browser, and every connection starts with the full current state, so nothing
 * is missed. If the stream keeps failing, or the browser has no EventSource,
 * the submission is polled every couple of seconds instead.
 */
export function useSubmissionLive(submissionId: string | null, initial?: Submission) {
  const [submission, setSubmission] = useState<Submission | undefined>(initial);
  const [connection, setConnection] = useState<Connection>('connecting');
  const [error, setError] = useState<Error | null>(null);
  const [attempt, setAttempt] = useState(0);
  const finished = useRef(false);

  // A different submission starts from what the caller already knows.
  useEffect(() => {
    finished.current = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets when the id changes
    setSubmission(initial);
    setError(null);
    setConnection('connecting');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId]);

  useEffect(() => {
    if (!submissionId) return;
    if (finished.current && submission?.status === 'completed') {
      setConnection('done');
      return;
    }
    let stopped = false;
    let source: EventSource | undefined;
    let timer: number | undefined;

    const apply = (next: Submission) => {
      if (stopped) return;
      setSubmission((previous) => ({ ...previous, ...next }));
      setError(null);
      if (next.status === 'completed') {
        finished.current = true;
        setConnection('done');
        source?.close();
        if (timer) window.clearTimeout(timer);
      }
    };

    const poll = async () => {
      if (stopped) return;
      setConnection((current) => (current === 'done' ? current : 'polling'));
      try {
        const next = await submissionsApi.get(submissionId);
        apply(next);
        if (next.status === 'completed' || stopped) return;
      } catch (caught) {
        if (stopped) return;
        setError(caught instanceof Error ? caught : new Error(String(caught)));
        setConnection('error');
      }
      timer = window.setTimeout(() => void poll(), POLL_MS);
    };

    if (typeof EventSource === 'undefined') {
      void poll();
    } else {
      let failures = 0;
      source = new EventSource(submissionEventsUrl(submissionId), { withCredentials: true });
      source.addEventListener('open', () => {
        failures = 0;
        if (!stopped) setConnection('live');
      });
      source.addEventListener('submission', (event) => {
        failures = 0;
        try {
          apply(JSON.parse((event as MessageEvent<string>).data) as Submission);
        } catch {
          /* ignore a malformed event; the next one carries the full state */
        }
      });
      source.addEventListener('error', () => {
        if (stopped || finished.current) return;
        failures++;
        // CLOSED: the server refused the stream (for example 401 or 404); the polling call tells us why.
        if (source!.readyState === EventSource.CLOSED || failures >= MAX_STREAM_FAILURES) {
          source!.close();
          void poll();
        } else {
          setConnection('reconnecting');
        }
      });
    }

    return () => {
      stopped = true;
      source?.close();
      if (timer) window.clearTimeout(timer);
    };
    // `submission` is deliberately not a dependency: the stream is restarted only by id or reload().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId, attempt]);

  /** Start over (after "check again"), using what the caller just received. */
  const restart = useCallback((next?: Submission) => {
    finished.current = false;
    if (next) setSubmission(next);
    setAttempt((current) => current + 1);
  }, []);

  return { submission, connection, error, restart };
}
