import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type BannerTone = 'info' | 'warning' | 'danger' | 'brand';

const ICONS: Record<BannerTone, LucideIcon> = {
  info: Info,
  warning: TriangleAlert,
  danger: CircleAlert,
  brand: CircleCheck,
};

/**
 * A strip of news inside the page: the outcome of Generate, an error or a timeout, a note about the version.
 * Not a toast: it stays until the situation changes. `danger` is announced at once (role="alert"); the others politely.
 */
export function Banner({
  tone = 'info',
  title,
  children,
  action,
  className,
}: {
  tone?: BannerTone;
  title?: string;
  children?: React.ReactNode;
  /** One or two buttons or links, e.g. "Try again". */
  action?: React.ReactNode;
  className?: string;
}) {
  const Icon = ICONS[tone];
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('vd-banner', `vd-banner--${tone}`, className)}>
      <Icon className="vd-icon vd-banner__icon size-4" strokeWidth={1.75} aria-hidden />
      <div className="vd-banner__body">
        {title && <p className="vd-banner__title">{title}</p>}
        {children && <div className="vd-banner__text">{children}</div>}
      </div>
      {action && <div className="vd-banner__action">{action}</div>}
    </div>
  );
}
