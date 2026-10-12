'use client';

import Link from 'next/link';
import { EmptyState } from '@/components/states/states';
import { buttonVariants } from '@/components/ui/button';
import { useRequireAuth } from '@/features/auth/hooks/use-require-auth';
import { useSpace } from '@/features/spaces/components/space-shell';

/** Tracks and Collections are managed by owners, administrators and editors (observers can look); solvers are turned away; Core checks every call again. */
export function ManagerGuard({ children }: { children: (editable: boolean) => React.ReactNode }) {
  useRequireAuth();
  const { space, abilities } = useSpace();
  if (!abilities.canAuthorProblems) {
    return (
      <EmptyState
        title="Only the Space’s staff can open Track management"
        description="You can follow the Tracks you can see from the Space’s overview."
        action={
          <Link href={`/spaces/${space.slug}`} className={buttonVariants({ variant: 'secondary' })}>
            Back to {space.name}
          </Link>
        }
      />
    );
  }
  return <>{children(abilities.canCreateProblems)}</>;
}
