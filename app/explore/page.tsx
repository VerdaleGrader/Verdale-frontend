import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ExploreView } from '@/features/spaces/components/explore-view';

export const metadata: Metadata = { title: 'Explore Spaces · Verdale' };

export default function ExplorePage() {
  // The view reads its filters from the URL query, which needs a Suspense boundary on a static page.
  return (
    <Suspense>
      <ExploreView />
    </Suspense>
  );
}
