import { BrandLogo } from '@/components/brand-logo';
import { SystemStatus } from '@/features/system/components/system-status';

export default function HomePage() {
  return (
    <main className="mx-auto flex max-w-[var(--measure)] flex-col gap-8 px-6 py-16 md:px-8">
      <BrandLogo />
      <header className="flex flex-col gap-2">
        <h1 className="text-display">Write a problem. Prove it. Let others solve it.</h1>
        <p className="text-prose text-text-muted">
          Verdale is a public judge where anyone can create a problem, check it against their own reference solution,
          and invite others to solve it.
        </p>
      </header>
      <SystemStatus />
    </main>
  );
}
