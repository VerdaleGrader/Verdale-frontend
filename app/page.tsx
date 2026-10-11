import { PageContainer } from '@/components/layout/page';
import { HomeActions } from '@/features/auth/components/home-actions';
import { SystemStatus } from '@/features/system/components/system-status';

export default function HomePage() {
  return (
    <PageContainer narrow className="gap-8 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-display">Write a problem. Prove it. Let others solve it.</h1>
        <p className="text-prose text-text-muted">
          Verdale is a public judge where anyone can create a problem, check it against their own reference solution,
          and invite others to solve it.
        </p>
      </header>
      <HomeActions />
      <SystemStatus />
    </PageContainer>
  );
}
