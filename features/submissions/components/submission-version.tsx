import { History } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/**
 * The Major a submission was sent to ("v2"), and an "Outdated version" mark when a newer Major is published.
 * The result is kept as it was; it is not judged again.
 */
export function SubmissionVersion({ major, outdated }: { major: number; outdated: boolean }) {
  return (
    <span className="vd-inline">
      <Badge>{`v${major}`}</Badge>
      {outdated && (
        <span title="A newer Major version is published. This result is kept and is not judged again.">
          <Badge tone="warning" icon={History}>
            Outdated version
          </Badge>
        </span>
      )}
    </span>
  );
}
