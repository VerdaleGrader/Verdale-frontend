import { Suspense } from 'react';
import { ReviewGate } from '@/features/submissions/components/review/review-parts';
import { ProblemSubmissionsView } from '@/features/submissions/components/review/submissions-view';

export default function MemberProblemSubmissionsPage() {
  return (
    <Suspense>
      <ReviewGate>
        <ProblemSubmissionsView mode="member" />
      </ReviewGate>
    </Suspense>
  );
}
