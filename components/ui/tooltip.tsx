'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/** One-line description on hover and keyboard focus, for icon-only buttons. Never the only place for information. */
export function Tooltip({
  label,
  side = 'top',
  children,
}: {
  label: string;
  side?: 'top' | 'bottom';
  children: React.ReactElement<{ 'aria-describedby'?: string }>;
}) {
  // Derived from the label, not useId(): stable between server and client rendering.
  const id = `tip-${label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}`;
  return (
    <span className={cn('vd-tip', side === 'bottom' && 'vd-tip--bottom')}>
      {React.cloneElement(children, { 'aria-describedby': id })}
      <span role="tooltip" id={id} className="vd-tip__bubble">
        {label}
      </span>
    </span>
  );
}
