'use client';

import Link from 'next/link';
import { EmptyState } from '@/components/states/states';
import { buttonVariants } from '@/components/ui/button';
import { useSpace } from '@/features/spaces/components/space-shell';

/**
 * The management pages are for the people who write in the Space (owner, administrator, editor, while it is not archived).
 * Anyone else gets this explanation instead; Core refuses their requests as well.
 */
export function ManageGuard({ children }: { children: React.ReactNode }) {
  const { space, abilities } = useSpace();
  if (abilities.canEditProblems) return <>{children}</>;
  return (
    <EmptyState
      title={abilities.archived ? 'This Space is archived' : 'Only authors can manage Tracks'}
      description={
        abilities.archived
          ? 'Tracks and Collections cannot be changed in an archived Space.'
          : 'Owners, administrators and editors create and arrange Tracks and Collections.'
      }
      action={
        <Link href={`/spaces/${space.slug}/tracks`} className={buttonVariants({ variant: 'secondary' })}>
          Back to Tracks
        </Link>
      }
    />
  );
}
