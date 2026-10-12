import { Suspense } from 'react';
import { ReviewGate } from '@/features/submissions/components/review/review-parts';
import { TrackProblemsView } from '@/features/submissions/components/review/track-problems-view';

export default function TrackProblemsPage() {
  return (
    <Suspense>
      <ReviewGate>
        <TrackProblemsView />
      </ReviewGate>
    </Suspense>
  );
}
