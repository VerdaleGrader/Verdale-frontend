import type { Metadata } from 'next';
import { ClosingCta, LandingFooter } from '@/features/landing/components/closing';
import { Hero } from '@/features/landing/components/hero';
import { HowItWorks } from '@/features/landing/components/how-it-works';
import { Judge } from '@/features/landing/components/judge';
import { Spaces } from '@/features/landing/components/spaces';
import { TwoSides } from '@/features/landing/components/two-sides';
import { OG_IMAGE, SITE_DESCRIPTION, SITE_LOCALE, SITE_NAME, SITE_TITLE, SITE_URL } from '@/lib/site-metadata';

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  openGraph: {
    siteName: SITE_NAME,
    type: 'website',
    locale: SITE_LOCALE,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: `${SITE_URL}/`,
    images: [OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE.url],
  },
};

export default function HomePage() {
  return (
    <>
      <main id="main">
        <Hero />
        <TwoSides />
        <HowItWorks />
        <Spaces />
        <Judge />
        <ClosingCta />
      </main>
      <LandingFooter />
    </>
  );
}
