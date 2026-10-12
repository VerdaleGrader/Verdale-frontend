import { Suspense } from 'react';
import { SubmissionsHome } from '@/features/submissions/components/review/submissions-home';

export default function SubmissionsPage() {
  return (
    <Suspense>
      <SubmissionsHome />
    </Suspense>
  );
}
