import { initialsOf } from '@/lib/format';
import { cn } from '@/lib/utils';

/* eslint-disable @next/next/no-img-element -- avatars are tiny remote images; next/image adds nothing here */
export function Avatar({
  name,
  src,
  size = 'md',
  className,
}: {
  name: string;
  src?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  if (src) return <img src={src} alt={name} className={cn('vd-avatar', `vd-avatar--${size}`, className)} />;
  return (
    <span role="img" aria-label={name} className={cn('vd-avatar', `vd-avatar--${size}`, className)}>
      <span aria-hidden>{initialsOf(name)}</span>
    </span>
  );
}
