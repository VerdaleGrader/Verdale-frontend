import type { components } from '@/lib/api-client';

export type Health = components['schemas']['HealthResponse'];
export type Readiness = components['schemas']['ReadinessResponse'];

export type SystemStatus =
  | { state: 'loading' }
  | { state: 'up'; version: string; checks: Readiness['checks'] }
  | { state: 'degraded'; version: string; checks: Readiness['checks'] }
  | { state: 'down' };
