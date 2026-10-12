import type { Metadata } from 'next';
import { Suspense } from 'react';
import { MySpacesView } from '@/features/spaces/components/my-spaces-view';

export const metadata: Metadata = { title: 'My Spaces · Verdale' };

export default function MySpacesPage() {
  // The view reads its filters from the URL query, which needs a Suspense boundary on a static page.
  return (
    <Suspense>
      <MySpacesView />
    </Suspense>
  );
}
