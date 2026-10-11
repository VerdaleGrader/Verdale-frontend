import type { Metadata } from 'next';
import { ExploreView } from '@/features/spaces/components/explore-view';

export const metadata: Metadata = { title: 'Explore Spaces · Verdale' };

export default function ExplorePage() {
  return <ExploreView />;
}
