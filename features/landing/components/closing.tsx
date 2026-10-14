import { useTranslations } from 'next-intl';
import { BrandLogo } from '@/components/brand-logo';
import { LandingActions } from './landing-actions';

/** Block mark made of the brand colours; decorative. */
function Mark() {
  // Three full rows of five, then two more.
  const dots = Array.from({ length: 17 }, (_, i) => ({ x: 28 + (i % 5) * 32, y: 28 + Math.floor(i / 5) * 32 }));
  const hollow = [
    [92, 124],
    [124, 124],
    [156, 124],
    [28, 156],
    [60, 156],
    [92, 156],
  ];
  return (
    <svg aria-hidden width="336" height="208" viewBox="0 0 336 208">
      <rect width="216" height="208" rx="8" className="fill-primary" />
      <rect x="232" width="104" height="48" rx="8" className="fill-accent" />
      <rect x="232" y="64" width="104" height="144" rx="8" className="fill-text" />
      <g className="fill-on-primary">
        {dots.map(({ x, y }) => (
          <rect key={`${x}-${y}`} x={x} y={y} width="16" height="16" rx="4" />
        ))}
      </g>
      <g className="stroke-on-primary fill-none" strokeWidth="1.5">
        {hollow.map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x! + 0.75} y={y! + 0.75} width="14.5" height="14.5" rx="4" />
        ))}
      </g>
      <g className="fill-bg">
        <rect x="256" y="168" width="16" height="16" rx="4" />
        <rect x="288" y="168" width="16" height="16" rx="4" />
      </g>
    </svg>
  );
}

export function ClosingCta() {
  const t = useTranslations('Landing.closing');
  return (
    <section aria-labelledby="cta-title" className="border-border border-t">
      <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-12 px-6 py-16 md:px-8 md:py-24">
        <div className="flex min-w-0 flex-[1_1_440px] flex-col gap-5">
          <h2 id="cta-title" className="text-display md:text-display-lg">
            {t('title')}
          </h2>
          <p className="text-prose text-text-muted max-w-[52ch]">{t('text')}</p>
          <div className="pt-1">
            <LandingActions />
          </div>
        </div>
        <div className="hidden flex-none min-[900px]:block">
          <Mark />
        </div>
      </div>
    </section>
  );
}

// Terms, Privacy and Contact are left out until those pages exist.
export function LandingFooter() {
  const t = useTranslations('Landing.closing');
  return (
    <footer className="border-border bg-surface border-t">
      <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-4 px-6 py-8 md:px-8">
        <div className="flex flex-col gap-1">
          <BrandLogo className="!text-body-strong !font-semibold" />
          <span className="text-small text-text-muted">{t('tagline')}</span>
        </div>
        <span className="text-small text-text-muted">© 2026 Verdale</span>
      </div>
    </footer>
  );
}
