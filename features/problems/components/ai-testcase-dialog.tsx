'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { TestProgress } from '@/components/grader/test-progress';
import { Banner } from '@/components/ui/banner';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog } from '@/components/ui/dialog';
import { Dropdown } from '@/components/ui/dropdown';
import { TextField } from '@/components/ui/field';
import { FilePreview } from '@/components/ui/file-preview';
import { RadioGroup } from '@/components/ui/radio-group';
import { useToast } from '@/components/ui/toast';
import { errorMessage } from '@/lib/api';
import { formatBytes, timeAgo } from '@/lib/format';
import { problemsApi, type ProblemTarget } from '../api/problems.api';
import {
  AI_CATEGORIES,
  AI_MAX_COUNT,
  AI_PROVIDERS,
  countProblem,
  draftsFromAi,
  failureHint,
  isRunning,
  providerCompany,
  providerLabel,
  usableItems,
} from '../ai-tests';
import { useAiTests } from '../hooks/use-ai-tests';
import type { DraftTest } from '../test-drafts';
import {
  LANGUAGE_LABELS,
  type AiCategory,
  type AiCredentialList,
  type AiProvider,
  type AiTestItem,
  type ReferenceSolution,
} from '../types';

interface AiTestcaseDialogProps {
  open: boolean;
  target: ProblemTarget;
  baseHref: string;
  /** How many more testcases the problem can hold. */
  room: number;
  makeKey: () => string;
  onClose: () => void;
  onAdd: (tests: DraftTest[]) => void;
}

const solutionLabel = (solution: ReferenceSolution, index: number) =>
  `Solution ${index + 1} (${LANGUAGE_LABELS[solution.language]})`;

/**
 * Generate with AI: a model (Gemini or Claude, with the author's own key) writes inputs, a saved solution produces
 * the expected outputs, and the result comes back as drafts to review. Nothing is added until the person confirms,
 * and what is added is still unsaved on the testcases page.
 */
export function AiTestcaseDialog(props: AiTestcaseDialogProps) {
  // Mounted only while open, so every opening starts from the first step (a running job is picked up again).
  return props.open ? <AiSteps {...props} /> : null;
}

function AiSteps({ target, baseHref, room, makeKey, onClose, onAdd }: AiTestcaseDialogProps) {
  const ai = useAiTests(target);
  const toast = useToast();
  const [credentials, setCredentials] = useState<AiCredentialList | null>(null);
  const [credentialsFailure, setCredentialsFailure] = useState<string | null>(null);
  const [solutions, setSolutions] = useState<ReferenceSolution[] | null>(null);
  const [solutionsFailure, setSolutionsFailure] = useState<string | null>(null);

  const [provider, setProvider] = useState<AiProvider>('gemini');
  const [countText, setCountText] = useState('5');
  const [categories, setCategories] = useState<AiCategory[]>([]);
  const [solutionId, setSolutionId] = useState('');
  const [includeSolution, setIncludeSolution] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startFailure, setStartFailure] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    problemsApi.aiCredentials().then(
      (list) => {
        if (cancelled) return;
        setCredentials(list);
        // Start on a provider the person already has a key for.
        const withKey = AI_PROVIDERS.find((item) => list.items.some((saved) => saved.provider === item.value));
        if (withKey) setProvider(withKey.value);
      },
      (caught: unknown) => !cancelled && setCredentialsFailure(errorMessage(caught))
    );
    problemsApi.solutions(target).then(
      (items) => {
        if (cancelled) return;
        setSolutions(items);
        setSolutionId((items.find((item) => item.is_primary) ?? items[0])?.id ?? '');
      },
      (caught: unknown) => !cancelled && setSolutionsFailure(errorMessage(caught))
    );
    return () => {
      cancelled = true;
    };
  }, [target]);

  const savedKey = credentials?.items.find((item) => item.provider === provider);
  const countError = countProblem(countText);
  const ready = credentials?.enabled === true && !!savedKey && !!solutionId && countError === null;

  async function begin() {
    setStarting(true);
    setStartFailure(null);
    try {
      await ai.start({
        provider,
        count: Number(countText.trim()),
        categories: categories.length > 0 ? categories : undefined,
        solution_id: solutionId,
        include_solution: includeSolution,
      });
    } catch (caught) {
      setStartFailure(errorMessage(caught));
    } finally {
      setStarting(false);
    }
  }

  const job = ai.job;
  if (job && isRunning(job)) {
    return (
      <Dialog
        open
        onClose={onClose}
        size="lg"
        title="Generating testcases"
        description="This runs on our servers. You can close this window and open it again; the drafts are kept for 24 hours."
        footer={
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        }
      >
        <div className="flex flex-col gap-3" role="status">
          <p className="vd-inline m-0">
            <LoaderCircle className="vd-icon vd-spin size-4" strokeWidth={1.75} aria-hidden />
            {job.status === 'generating'
              ? `Generating inputs with ${providerLabel(job.provider)}`
              : 'Computing expected outputs with your solution'}
          </p>
          {job.status === 'computing' && (
            <TestProgress
              results={job.items.filter((item) => item.status === 'pending').map(() => 'RUNNING' as const)}
              label="Computing expected outputs"
              ariaLabel="Computing expected outputs"
            />
          )}
          {ai.lostContact && (
            <Banner
              tone="warning"
              title="Lost contact with the server"
              action={
                <Button size="sm" onClick={ai.pollAgain}>
                  Check again
                </Button>
              }
            >
              The job may still be running.
            </Banner>
          )}
        </div>
      </Dialog>
    );
  }

  if (job && job.status === 'failed') {
    const hint = job.error ? failureHint(job.error.code) : null;
    return (
      <Dialog
        open
        onClose={onClose}
        size="lg"
        title="Could not generate testcases"
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            <Button variant="primary" onClick={ai.clear}>
              Try again
            </Button>
          </>
        }
      >
        <Banner tone="danger" title={job.error?.message ?? 'Something went wrong. Try again.'}>
          {hint}
        </Banner>
      </Dialog>
    );
  }

  if (job && job.status === 'completed') {
    return (
      <Review
        job={job}
        room={room}
        makeKey={makeKey}
        target={target}
        onClose={onClose}
        onAdd={onAdd}
        toast={toast}
        onBack={ai.clear}
      />
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title="Generate with AI"
      description="A model drafts testcase inputs from your statement. A saved solution then runs on them to produce the expected outputs. Nothing is added until you confirm."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!ready || starting} onClick={() => void begin()}>
            Generate testcases
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {credentialsFailure && (
          <p role="alert" className="vd-hint vd-hint--error">
            Could not load your saved keys. {credentialsFailure}
          </p>
        )}
        {credentials && !credentials.enabled && (
          <Banner tone="info">Generating testcases with AI is not set up on this server yet.</Banner>
        )}
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="vd-label">Provider</legend>
          <RadioGroup
            aria-label="Provider"
            value={provider}
            onValueChange={(next) => setProvider(next as AiProvider)}
            options={AI_PROVIDERS.map((item) => ({
              value: item.value,
              label: item.label,
              description: item.description,
            }))}
          />
        </fieldset>
        {credentials?.enabled && (
          <KeyBox
            key={provider}
            provider={provider}
            last4={savedKey?.last4}
            onChanged={(list) => setCredentials(list)}
          />
        )}
        <TextField
          label="Number of testcases"
          inputMode="numeric"
          value={countText}
          onChange={(event) => setCountText(event.target.value)}
          hint={`Between 1 and ${AI_MAX_COUNT}.`}
          error={countError ?? undefined}
        />
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="vd-label">Categories (optional)</legend>
          <p className="vd-hint m-0">Leave all unticked and the model follows your statement.</p>
          {AI_CATEGORIES.map((category) => (
            <Checkbox
              key={category.value}
              label={category.label}
              description={category.description}
              checked={categories.includes(category.value)}
              onCheckedChange={(checked) =>
                setCategories((current) =>
                  checked === true ? [...current, category.value] : current.filter((item) => item !== category.value)
                )
              }
            />
          ))}
        </fieldset>
        {solutionsFailure ? (
          <p role="alert" className="vd-hint vd-hint--error">
            Could not load the solutions. {solutionsFailure}
          </p>
        ) : solutions === null ? (
          <p role="status" className="tc-sub">
            Loading the solutions…
          </p>
        ) : solutions.length === 0 ? (
          <p className="tc-sub">
            There is no saved solution yet.{' '}
            <Link href={`${baseHref}/solutions`} className={buttonVariants({ variant: 'link', size: 'sm' })}>
              Add one on the Solutions tab
            </Link>
            , then come back. The expected outputs come from a solution.
          </p>
        ) : (
          <Dropdown
            label="Solution for the expected outputs"
            hint="Only solutions saved on the Solutions tab are listed."
            options={solutions.map((solution, at) => ({
              value: solution.id,
              label: solutionLabel(solution, at),
              description: `${solution.is_primary ? 'Primary · ' : ''}${formatBytes(solution.source_bytes)} · edited ${timeAgo(solution.updated_at)}`,
            }))}
            value={solutionId}
            onValueChange={setSolutionId}
          />
        )}
        <Checkbox
          label="Also send the solution’s code to the provider"
          description="Off by default. Only the statement and the limits are sent."
          checked={includeSolution}
          onCheckedChange={(checked) => setIncludeSolution(checked === true)}
        />
        {includeSolution && (
          <Banner tone="warning" title={`The code goes to ${providerCompany(provider)}`}>
            The selected solution will be sent to {providerCompany(provider)} with your API key, and their terms apply
            to it. Untick this to send only the statement and the limits.
          </Banner>
        )}
        {startFailure && (
          <p role="alert" className="vd-hint vd-hint--error">
            {startFailure}
          </p>
        )}
      </div>
    </Dialog>
  );
}

/** The key for one provider: saved keys show only their last four characters, and can be replaced or removed. */
function KeyBox({
  provider,
  last4,
  onChanged,
}: {
  provider: AiProvider;
  last4: string | undefined;
  onChanged: (list: AiCredentialList) => void;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState(last4 === undefined);
  const [keyText, setKeyText] = useState('');
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  async function save() {
    setSaving(true);
    setFailure(null);
    try {
      await problemsApi.saveAiCredential(provider, keyText.trim());
      onChanged(await problemsApi.aiCredentials());
      setKeyText('');
      setEditing(false);
      toast({ tone: 'success', title: `${providerLabel(provider)} key saved` });
    } catch (caught) {
      setFailure(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setSaving(true);
    try {
      await problemsApi.deleteAiCredential(provider);
      onChanged(await problemsApi.aiCredentials());
      setRemoving(false);
      setEditing(true);
      toast({ tone: 'success', title: `${providerLabel(provider)} key removed` });
    } catch (caught) {
      setRemoving(false);
      setFailure(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="ai-key">
      {editing ? (
        <>
          <TextField
            label={`${providerLabel(provider)} API key`}
            type="password"
            mono
            autoComplete="off"
            spellCheck={false}
            value={keyText}
            onChange={(event) => setKeyText(event.target.value)}
            hint="Stored encrypted and used only on our servers for your requests. It is never shown again in full."
            error={failure ?? undefined}
          />
          <div className="ai-key__row">
            <span />
            <span className="vd-inline">
              {last4 !== undefined && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditing(false);
                    setKeyText('');
                    setFailure(null);
                  }}
                >
                  Cancel
                </Button>
              )}
              <Button size="sm" disabled={keyText.trim() === '' || saving} onClick={() => void save()}>
                Save key
              </Button>
            </span>
          </div>
        </>
      ) : (
        <div className="ai-key__row">
          <span>
            {providerLabel(provider)} key saved, ending in <span className="tc-code">{last4}</span>
          </span>
          <span className="vd-inline">
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
              Change key
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setRemoving(true)}>
              Remove key
            </Button>
          </span>
        </div>
      )}
      {!editing && failure && (
        <p role="alert" className="vd-hint vd-hint--error">
          {failure}
        </p>
      )}
      <Dialog
        open={removing}
        onClose={() => setRemoving(false)}
        title={`Remove your ${providerLabel(provider)} key?`}
        description="You will need to enter a key again before you can generate testcases with this provider."
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoving(false)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={saving} onClick={() => void remove()}>
              Remove key
            </Button>
          </>
        }
      />
    </div>
  );
}

/** Review: keep or drop each draft, edit an input, then add the ticked ones to the testcases page. */
function Review({
  job,
  room,
  makeKey,
  target,
  onClose,
  onAdd,
  onBack,
  toast,
}: {
  job: NonNullable<ReturnType<typeof useAiTests>['job']>;
  room: number;
  makeKey: () => string;
  target: ProblemTarget;
  onClose: () => void;
  onAdd: (tests: DraftTest[]) => void;
  onBack: () => void;
  toast: ReturnType<typeof useToast>;
}) {
  const usable = useMemo(() => usableItems(job), [job]);
  const skipped = job.items.filter((item) => item.status === 'skipped');
  const [kept, setKept] = useState<Set<string>>(() => new Set(usable.map((item) => item.id)));
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const chosen = usable.filter((item) => kept.has(item.id));
  const tooMany = chosen.length > room;
  const label = (item: AiTestItem) => `Draft ${item.position + 1}`;

  async function add() {
    setAdding(true);
    setFailure(null);
    try {
      const drafts = await draftsFromAi(chosen, edits, makeKey, (text) => problemsApi.stageFile(target, { text }));
      onAdd(drafts);
      toast({
        tone: 'success',
        title: `Added ${drafts.length} ${drafts.length === 1 ? 'testcase' : 'testcases'}`,
        description: 'They are unsaved changes. Save the page to keep them.',
      });
      onClose();
    } catch (caught) {
      setFailure(errorMessage(caught));
      setAdding(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title="Review the drafts"
      description={`${usable.length} of ${job.items.length} ${job.items.length === 1 ? 'draft is' : 'drafts are'} ready${
        skipped.length > 0 ? `, ${skipped.length} skipped` : ''
      }. Nothing is added until you confirm.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Discard drafts
          </Button>
          <Button variant="primary" disabled={chosen.length === 0 || tooMany || adding} onClick={() => void add()}>
            {`Add ${chosen.length} ${chosen.length === 1 ? 'testcase' : 'testcases'}`}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {usable.length === 0 && (
          <Banner
            tone="warning"
            title="No draft could be used"
            action={
              <Button size="sm" onClick={onBack}>
                Try again
              </Button>
            }
          >
            Every input was skipped. The reasons are below.
          </Banner>
        )}
        {tooMany && (
          <Banner tone="warning">
            Only {room} more {room === 1 ? 'testcase fits' : 'testcases fit'} in this problem. Untick some drafts.
          </Banner>
        )}
        {failure && <Banner tone="danger">{failure}</Banner>}
        <div className="ai-drafts">
          {usable.map((item) => {
            const edited = edits[item.id] !== undefined && edits[item.id] !== item.input_text;
            const text = edits[item.id] ?? item.input_text ?? '';
            return (
              <div className="ai-draft" key={item.id}>
                <div className="ai-draft__head">
                  <Checkbox
                    label={label(item)}
                    description={
                      edited
                        ? 'Edited. Its expected output is made again with Generate expected output after you save.'
                        : `${formatBytes(item.input?.size_bytes ?? 0)} input · ${formatBytes(item.output?.size_bytes ?? 0)} expected output`
                    }
                    checked={kept.has(item.id)}
                    onCheckedChange={(checked) =>
                      setKept((current) => {
                        const next = new Set(current);
                        if (checked === true) next.add(item.id);
                        else next.delete(item.id);
                        return next;
                      })
                    }
                  />
                  <Button size="sm" variant="ghost" onClick={() => setEditing(editing === item.id ? null : item.id)}>
                    {editing === item.id ? 'Done' : 'Edit input'}
                  </Button>
                </div>
                {editing === item.id ? (
                  <TextField
                    aria-label={`Input of ${label(item)}`}
                    multiline
                    mono
                    rows={6}
                    value={text}
                    onChange={(event) => setEdits((current) => ({ ...current, [item.id]: event.target.value }))}
                  />
                ) : (
                  <FilePreview name={`${label(item)} input`} text={text} />
                )}
                {item.output_preview !== null && !edited && (
                  <FilePreview name={`${label(item)} expected output`} text={item.output_preview} />
                )}
              </div>
            );
          })}
          {skipped.map((item) => (
            <div className="ai-draft ai-draft--skipped" key={item.id}>
              <div className="ai-draft__head">
                <span>{label(item)}</span>
                <Badge tone="warning">Skipped</Badge>
              </div>
              <p className="tc-sub m-0">{item.skip_reason}</p>
            </div>
          ))}
        </div>
      </div>
    </Dialog>
  );
}
