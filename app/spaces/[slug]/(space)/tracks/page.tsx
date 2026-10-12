import { Suspense } from 'react';
import { TracksView } from '@/features/catalog/components/tracks-view';

export default function TracksPage() {
  return (
    <Suspense>
      <TracksView />
    </Suspense>
  );
}
