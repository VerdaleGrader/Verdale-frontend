import { Suspense } from 'react';
import { ReviewGate } from '@/features/submissions/components/review/review-parts';
import { MemberProblemsView } from '@/features/submissions/components/review/member-problems-view';

export default function MemberProblemsPage() {
  return (
    <Suspense>
      <ReviewGate>
        <MemberProblemsView />
      </ReviewGate>
    </Suspense>
  );
}
