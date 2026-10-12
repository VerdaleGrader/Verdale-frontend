'use client';

import { Suspense } from 'react';
import { TracksView } from '@/features/catalog/components/tracks-view';
import { ProblemList } from '@/features/problems/components/problem-list';
import { useSpace } from './space-shell';

/**
 * Overview of a Space. The Space's staff see its problems; everybody else (solvers, other members,
 * visitors) sees the Tracks they can open, never the problems or Collections of the Space directly.
 */
export function SpaceOverview() {
  const { abilities } = useSpace();
  if (abilities.canAuthorProblems) return <ProblemList />;
  return (
    <Suspense>
      <TracksView />
    </Suspense>
  );
}
