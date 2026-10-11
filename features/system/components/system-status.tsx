'use client';

import { CircleCheck, CircleX, LoaderCircle, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSystemStatus } from '../hooks/use-system-status';
import type { SystemStatus as Status } from '../types';

const presentation = {
  loading: { icon: LoaderCircle, label: 'Checking Core', tone: 'bg-verdict-pending-soft text-verdict-pending' },
  up: { icon: CircleCheck, label: 'Core is ready', tone: 'bg-verdict-ac-soft text-verdict-ac' },
  degraded: { icon: TriangleAlert, label: 'Core is up but not ready', tone: 'bg-warning-soft text-warning' },
  down: { icon: CircleX, label: 'Core is unreachable', tone: 'bg-danger-soft text-danger' },
} as const;

export function SystemStatus({ load }: { load?: () => Promise<Status> }) {
  const { status, refresh } = useSystemStatus(load);
  const { icon: Icon, label, tone } = presentation[status.state];

  return (
    <section aria-live="polite" className="border-border bg-surface rounded-md border p-4">
      <div className="flex items-center justify-between gap-4">
        <span className={`text-body-strong inline-flex items-center gap-1 rounded-sm px-2 py-1 ${tone}`}>
          <Icon
            className={`size-4 ${status.state === 'loading' ? 'motion-safe:animate-spin' : ''}`}
            strokeWidth={1.75}
          />
          {label}
        </span>
        <Button size="sm" onClick={refresh} disabled={status.state === 'loading'}>
          Check again
        </Button>
      </div>
      {'checks' in status && (
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
          <dt className="text-caption text-text-muted">Version</dt>
          <dd className="text-mono-label">{status.version}</dd>
          {Object.entries(status.checks).map(([name, ok]) => (
            <div key={name} className="contents">
              <dt className="text-caption text-text-muted capitalize">{name}</dt>
              <dd className={`text-mono-label ${ok ? 'text-verdict-ac' : 'text-danger'}`}>{ok ? 'OK' : 'Failing'}</dd>
            </div>
          ))}
        </dl>
      )}
      {status.state === 'down' && (
        <p className="text-small text-text-muted mt-3">
          Start Core with npm run dev in Verdale-core-service, then check again.
        </p>
      )}
    </section>
  );
}
