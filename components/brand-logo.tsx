import { cn } from '@/lib/utils';

/** No logo yet: the name in Plex Sans 600 with a primary square (design system README). */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <span className={cn('text-h3 text-text inline-flex items-center gap-2', className)}>
      <span aria-hidden className="bg-primary size-3 rounded-sm" />
      Verdale
    </span>
  );
}
