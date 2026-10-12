'use client';

import { useCallback, useState } from 'react';
import { initialsOf } from '@/lib/format';
import { cn } from '@/lib/utils';

/** A picture when there is one and it loads; otherwise the initials, so a broken link never shows a broken image. */
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
  // Remember which address failed, so a new address gets its own chance.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const classes = cn('vd-avatar', `vd-avatar--${size}`, className);
  // A picture that failed before React attached onError (server-rendered, or cached as broken) never
  // fires the event again, so look at the element itself once it is in the page.
  const check = useCallback(
    (image: HTMLImageElement | null) => {
      if (image && image.complete && image.naturalWidth === 0 && src) setFailedSrc(src);
    },
    [src]
  );
  if (src && src !== failedSrc) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- avatars are tiny remote images; next/image adds nothing here
      <img
        ref={check}
        src={src}
        alt={name}
        className={classes}
        // The picture comes from the sign-in provider; do not tell its host which page we are on.
        referrerPolicy="no-referrer"
        loading="lazy"
        onError={() => setFailedSrc(src)}
      />
    );
  }
  return (
    <span role="img" aria-label={name} className={classes}>
      <span aria-hidden>{initialsOf(name)}</span>
    </span>
  );
}
