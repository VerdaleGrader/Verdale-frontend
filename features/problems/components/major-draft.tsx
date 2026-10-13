'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { useSpace } from '@/features/spaces/components/space-shell';
import { useMajorDraft } from '../hooks/use-major-draft';
import { hasMajorDraft, isUpdatable } from '../versioning';
import { useProblemWorkspace } from './problem-workspace';

/** Shown on every tab while a Major draft is open: which version solvers use, which one this is, and Discard. */
export function MajorDraftBanner() {
  const { target, editor, setEditor, refresh } = useProblemWorkspace();
  const { space, abilities } = useSpace();
  const draft = useMajorDraft({ target, setEditor, refresh });
  const [confirming, setConfirming] = useState(false);
  if (!hasMajorDraft(editor) || !editor.open_version) return null;
  const canDiscard = abilities.canEditProblems && editor.version.status !== 'verifying';

  return (
    <>
      <Banner
        tone="info"
        title={`Solvers use ${editor.open_version.label}. You are working on the draft ${editor.version.label}.`}
        action={
          <>
            <Link href={`/spaces/${space.slug}/problems/${editor.slug}`} className="vd-link">
              View open version
            </Link>
            {abilities.canEditProblems && (
              <Button size="sm" onClick={() => setConfirming(true)} disabled={!canDiscard || draft.busy}>
                Discard draft
              </Button>
            )}
          </>
        }
      >
        The draft needs Verify and Publish before it replaces {editor.open_version.label}. Until then nothing changes
        for solvers.
      </Banner>
      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={`Discard the draft ${editor.version.label}?`}
        description={`Your changes in the draft, including its tests and solutions, are deleted. ${editor.open_version.label} stays open and is not affected.`}
        footer={
          <>
            <Button onClick={() => setConfirming(false)} disabled={draft.busy}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={draft.busy}
              onClick={async () => {
                await draft.discard();
                setConfirming(false);
              }}
            >
              {draft.busy ? 'Discarding…' : 'Discard draft'}
            </Button>
          </>
        }
      />
    </>
  );
}

/** On the Testcases and Solutions tabs of a published problem: they can only change in a Major draft. */
export function StartMajorDraftOffer() {
  const { target, editor, setEditor, refresh } = useProblemWorkspace();
  const { abilities } = useSpace();
  const draft = useMajorDraft({ target, setEditor, refresh });
  if (!isUpdatable(editor)) return null;
  return (
    <Banner
      tone="info"
      title="Testcases and reference solutions can only change in a Major draft"
      action={
        abilities.canEditProblems ? (
          <Button size="sm" variant="primary" onClick={() => void draft.start()} disabled={draft.busy}>
            {draft.busy ? 'Starting…' : 'Start a Major draft'}
          </Button>
        ) : undefined
      }
    >
      A change to tests or solutions is always a Major update. The draft starts as a copy of {editor.version.label};
      solvers keep using {editor.version.label} until the draft passes verification and is published.
    </Banner>
  );
}
