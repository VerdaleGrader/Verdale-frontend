'use client';

import { useSpace } from '@/features/spaces/components/space-shell';
import { param, useUrlQuery } from '@/lib/use-url-query';
import { ByMemberView } from './by-member-view';
import { ByProblemView } from './by-problem-view';
import { ByTrackView } from './by-track-view';
import { GroupTabs, ReviewGate, ReviewIntro } from './review-parts';

const GROUPS = ['member', 'track', 'problem'] as const;
const QUERY = { group: param.oneOf(GROUPS, 'member') };

const INTRO = {
  member:
    'Every submission in this Space. Owners, administrators, editors and observers can see all of them; solvers see only their own.',
  track: 'Pick a track to see its problems, then the submissions made from that track.',
  problem: 'Every problem in the Space, whichever tracks it is in. Pick one to see all its submissions.',
};

/** Submissions of the whole Space for staff: Group by Member, Track or Problem (the group is in the URL). */
export function SubmissionsHome() {
  const { space } = useSpace();
  const {
    values: { group },
  } = useUrlQuery(QUERY);
  return (
    <ReviewGate>
      <ReviewIntro title="Submissions" description={INTRO[group]} />
      <GroupTabs slug={space.slug} active={group} />
      {/* A key per group: each view starts with its own filters and state. */}
      {group === 'member' && <ByMemberView key="member" />}
      {group === 'track' && <ByTrackView key="track" />}
      {group === 'problem' && <ByProblemView key="problem" />}
    </ReviewGate>
  );
}
