import { coreApi } from '@/lib/api-client';
import type { SystemStatus } from '../types';

/** Repository: pure API calls, no state. */
export async function fetchSystemStatus(): Promise<SystemStatus> {
  try {
    const health = await fetch('/core/health', { cache: 'no-store' });
    if (!health.ok) return { state: 'down' };
    const { version } = (await health.json()) as { version: string };
    const ready = await fetch('/core/ready', { cache: 'no-store' });
    const readiness = (await ready.json()) as { status: string; checks: Record<string, boolean> };
    return { state: readiness.status === 'ready' ? 'up' : 'degraded', version, checks: readiness.checks };
  } catch {
    return { state: 'down' };
  }
}

// The typed client is used for /api/* routes as they are added, e.g.
// const { data, error } = await coreApi.GET('/api/v1/...').
void coreApi;
