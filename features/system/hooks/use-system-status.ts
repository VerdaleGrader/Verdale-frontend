'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchSystemStatus } from '../api/system.api';
import type { SystemStatus } from '../types';

/** Controller: owns the state; the component only renders it. */
export function useSystemStatus(load: () => Promise<SystemStatus> = fetchSystemStatus) {
  const [status, setStatus] = useState<SystemStatus>({ state: 'loading' });

  const refresh = useCallback(async () => {
    setStatus({ state: 'loading' });
    setStatus(await load());
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    load().then((next) => {
      if (!cancelled) setStatus(next);
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  return { status, refresh };
}
