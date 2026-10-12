'use client';

import { useState } from 'react';
import { initialsOf } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * A person's picture, or their initials when there is no picture or it cannot
 * be loaded. `src` is the `avatar_url` Core sends (null when the sign-in
 * provider has none).
 */
/* eslint-disable @next/next/no-img-element -- avatars are tiny remote images; next/image adds nothing here */
export function Avatar({
  name,
  src,
  size = 'md',
  className,
}: {
  name: string;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  // The address that failed, so a new picture (a different address) is tried again.
  const [failed, setFailed] = useState<string | null>(null);
  if (src && failed !== src) {
    return (
      <img
        src={src}
        alt={name}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(src)}
        className={cn('vd-avatar', `vd-avatar--${size}`, className)}
      />
    );
  }
  return (
    <span role="img" aria-label={name} className={cn('vd-avatar', `vd-avatar--${size}`, className)}>
      <span aria-hidden>{initialsOf(name)}</span>
    </span>
  );
}
