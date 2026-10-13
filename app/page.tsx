import { ClosingCta, LandingFooter } from '@/features/landing/components/closing';
import { Hero } from '@/features/landing/components/hero';
import { HowItWorks } from '@/features/landing/components/how-it-works';
import { Judge } from '@/features/landing/components/judge';
import { Spaces } from '@/features/landing/components/spaces';
import { TwoSides } from '@/features/landing/components/two-sides';

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
