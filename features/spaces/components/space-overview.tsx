'use client';

import Link from 'next/link';
import { EmptyState } from '@/components/states/states';
import { buttonVariants } from '@/components/ui/button';
import { useAuth } from '@/features/auth/hooks/auth-provider';
import { useSpace } from './space-shell';

/** Overview of a Space. Problems arrive in M3, so for now this explains what the Space is and what you can do. */
export function SpaceOverview() {
  const { space, abilities } = useSpace();
  const { auth } = useAuth();

  return (
    <section aria-labelledby="problems-heading" className="flex flex-col gap-3">
      <h2 id="problems-heading" className="text-h2">
        Problems
      </h2>
      <EmptyState
        title="No problems yet"
        description={
          abilities.archived
            ? 'This Space was archived without problems.'
            : space.my_role === 'owner' || space.my_role === 'editor'
              ? 'You will be able to create problems here soon.'
              : 'Problems published in this Space will appear here.'
        }
        action={
          auth.status === 'anonymous' ? (
            <Link
              href={`/login?next=${encodeURIComponent(`/spaces/${space.slug}`)}`}
              className={buttonVariants({ variant: 'secondary' })}
            >
              Log in to take part
            </Link>
          ) : undefined
        }
      />
    </section>
  );
}
