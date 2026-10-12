import { Suspense } from 'react';
import { SubmissionReview } from '@/features/submissions/components/review/submission-review';

export default function SubmissionReviewPage() {
  return (
    <Suspense>
      <SubmissionReview />
    </Suspense>
  );
}
