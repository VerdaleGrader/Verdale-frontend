'use client';

import { useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Download, FileUp, Trash2, Upload } from 'lucide-react';
import { EmptyState, ErrorState, Loading } from '@/components/states/states';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { TextField } from '@/components/ui/field';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { ApiError, errorMessage } from '@/lib/api';
import { useRefreshableQuery } from '@/lib/use-api-query';
import { cn } from '@/lib/utils';
import { problemsApi, testFileUrl } from '../api/problems.api';
import { pairTestFiles, type Pair } from '../test-files';
import { formatBytes, type TestCase, type TestCaseList } from '../types';
import { useProblemWorkspace } from './problem-workspace';

/** Core's message for a failed upload: the file-level details when there are any. */
export function uploadFailureMessage(error: unknown): string {
  if (error instanceof ApiError && error.details && error.details.length > 0) {
    return error.details.map((detail) => detail.message).join(' ');
  }
  return errorMessage(error);
}

function Meter({ label, value, max, text }: { label: string; value: number; max: number; text: string }) {
  const ratio = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <div className="flex min-w-48 flex-1 flex-col gap-1">
      <div className="text-small flex justify-between gap-2">
        <span className="text-text-muted">{label}</span>
        <span className="vd-mono">{text}</span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={text}
        className="bg-surface-sunken h-2 overflow-hidden rounded-full"
      >
        <div
          className={cn('h-full rounded-full', ratio >= 0.9 ? 'bg-warning' : 'bg-primary')}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}

/** The Tests tab: add, check, order and mark tests, with the totals against the limits. */
export function TestManager() {
  const { target, editor, refresh } = useProblemWorkspace();
  const toast = useToast();
  const loaded = useRefreshableQuery(() => problemsApi.tests(target), `tests-${target.slug}-${target.problemSlug}`);
  const [busy, setBusy] = useState<string | null>(null);
  const [replacing, setReplacing] = useState<TestCase | null>(null);
  const [removing, setRemoving] = useState<TestCase | null>(null);

  if (loaded.status === 'loading') return <Loading label="Loading tests" />;
  if (loaded.status === 'error') return <ErrorState error={loaded.error} onRetry={loaded.reload} />;
  const data: TestCaseList = loaded.data;
  // Fetch again quietly: the upload list below must survive it.
  const reload = async () => {
    await Promise.all([loaded.refetch(), refresh()]);
  };

  async function run(key: string, action: () => Promise<unknown>, failure: string) {
    setBusy(key);
    try {
      await action();
      await reload();
    } catch (caught) {
      toast({ tone: 'danger', title: failure, description: uploadFailureMessage(caught) });
    } finally {
      setBusy(null);
    }
  }

  const move = (index: number, delta: -1 | 1) => {
    const ids = data.items.map((item) => item.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(index + delta, 0, moved!);
    void run(`move-${index}`, () => problemsApi.reorderTests(target, ids), 'Could not change the order');
  };

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Totals" className="flex flex-wrap gap-6">
        <Meter
          label="Tests"
          value={data.summary.count}
          max={data.limits.max_count}
          text={`${data.summary.count} of ${data.limits.max_count}`}
        />
        <Meter
          label="Total size"
          value={data.summary.total_bytes}
          max={data.limits.max_total_bytes}
          text={`${formatBytes(data.summary.total_bytes)} of ${formatBytes(data.limits.max_total_bytes)}`}
        />
        <Meter
          label="Samples shown to solvers"
          value={data.summary.sample_count}
          max={data.limits.max_samples}
          text={`${data.summary.sample_count} of ${data.limits.max_samples}`}
        />
      </section>

      {data.editable && (
        <AddTests
          samplesSoFar={data.summary.sample_count}
          maxFileBytes={data.limits.max_file_bytes}
          maxSampleBytes={data.limits.max_sample_bytes}
          onChanged={reload}
        />
      )}

      <section aria-labelledby="tests-heading" className="flex flex-col gap-3">
        <h2 id="tests-heading" className="text-h2">
          Tests in judging order
        </h2>
        {data.items.length === 0 ? (
          <EmptyState
            title="No tests yet"
            description={
              data.editable
                ? 'Add at least one sample test (shown to solvers) and the hidden tests that decide the verdict.'
                : 'This version has no tests.'
            }
          />
        ) : (
          <div className="vd-tablewrap">
            <table className="vd-table">
              <caption className="vd-sr">Tests of this problem</caption>
              <thead>
                <tr>
                  <th scope="col" className="is-num">
                    #
                  </th>
                  <th scope="col">Visible to solvers</th>
                  <th scope="col" className="is-num">
                    Input
                  </th>
                  <th scope="col" className="is-num">
                    Output
                  </th>
                  <th scope="col">
                    <span className="vd-sr">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((test, index) => (
                  <tr key={test.id}>
                    <td className="is-num vd-mono">{test.position}</td>
                    <td>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={test.is_sample}
                          disabled={!data.editable || busy !== null}
                          aria-label={`Test ${test.position} is a sample`}
                          onChange={(event) =>
                            void run(
                              `sample-${test.id}`,
                              () => problemsApi.setTestSample(target, test.id, event.target.checked),
                              'Could not change the sample'
                            )
                          }
                        />
                        <span className="text-small">{test.is_sample ? 'Sample' : 'Hidden'}</span>
                      </label>
                    </td>
                    <td className="is-num">
                      <a className="vd-link vd-mono" href={testFileUrl(target, test.id, 'input')} download>
                        {formatBytes(test.input_size_bytes)}
                        <Download
                          className="ml-1 inline size-3.5"
                          aria-label={`Download input of test ${test.position}`}
                        />
                      </a>
                    </td>
                    <td className="is-num">
                      <a className="vd-link vd-mono" href={testFileUrl(target, test.id, 'output')} download>
                        {formatBytes(test.output_size_bytes ?? 0)}
                        <Download
                          className="ml-1 inline size-3.5"
                          aria-label={`Download output of test ${test.position}`}
                        />
                      </a>
                    </td>
                    <td>
                      {data.editable && (
                        <span className="flex flex-wrap justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Move test ${test.position} up`}
                            disabled={index === 0 || busy !== null}
                            onClick={() => move(index, -1)}
                          >
                            <ArrowUp aria-hidden />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Move test ${test.position} down`}
                            disabled={index === data.items.length - 1 || busy !== null}
                            onClick={() => move(index, 1)}
                          >
                            <ArrowDown aria-hidden />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Replace files of test ${test.position}`}
                            disabled={busy !== null}
                            onClick={() => setReplacing(test)}
                          >
                            <FileUp aria-hidden />
                            Replace
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Delete test ${test.position}`}
                            disabled={busy !== null}
                            onClick={() => setRemoving(test)}
                          >
                            <Trash2 aria-hidden />
                          </Button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {editor.tests.count !== data.summary.count && <p className="sr-only">Updating totals</p>}
      </section>

      <ReplaceDialog
        key={replacing?.id ?? 'none'}
        test={replacing}
        onClose={() => setReplacing(null)}
        onReplace={async (files) => {
          const test = replacing!;
          await problemsApi.replaceTest(target, test.id, files);
          setReplacing(null);
          await reload();
          toast({ tone: 'success', title: `Test ${test.position} updated` });
        }}
      />
      <Dialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title={`Delete test ${removing?.position ?? ''}?`}
        description="The tests after it move up by one. The files stay in storage in case another test uses them."
        footer={
          <>
            <Button onClick={() => setRemoving(null)} disabled={busy !== null}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy !== null}
              onClick={async () => {
                const test = removing!;
                setRemoving(null);
                await run(
                  `delete-${test.id}`,
                  () => problemsApi.removeTest(target, test.id),
                  'Could not delete the test'
                );
              }}
            >
              Delete test
            </Button>
          </>
        }
      />
    </div>
  );
}

// --- adding tests ---------------------------------------------------------

interface PendingPair {
  id: string;
  name: string;
  input: File;
  output: File;
  sample: boolean;
  status: 'ready' | 'uploading' | 'done' | 'error';
  message?: string;
}

function AddTests({
  samplesSoFar,
  maxFileBytes,
  maxSampleBytes,
  onChanged,
}: {
  samplesSoFar: number;
  maxFileBytes: number;
  maxSampleBytes: number;
  onChanged: () => Promise<void>;
}) {
  const { target } = useProblemWorkspace();
  const toast = useToast();
  const [pairs, setPairs] = useState<PendingPair[]>([]);
  const [unpaired, setUnpaired] = useState<Array<{ name: string; reason: string }>>([]);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const files = useRef<HTMLInputElement>(null);
  const folder = useRef<HTMLInputElement>(null);
  const nextId = useRef(0);

  function addFiles(chosen: File[]) {
    const picked = chosen.map((file) => Object.assign(file, { path: file.webkitRelativePath || file.name }));
    const result = pairTestFiles(picked);
    setUnpaired(result.unpaired.map(({ file, reason }) => ({ name: file.name, reason })));
    setPairs((current) => {
      const taken = new Set(current.map((pair) => pair.name));
      const fresh = result.pairs
        .filter((pair: Pair<File>) => !taken.has(pair.name))
        .map((pair: Pair<File>, index: number) => ({
          id: String(nextId.current++),
          name: pair.name,
          input: pair.input,
          output: pair.output,
          // With no sample yet, the first test is the natural one to show.
          sample: samplesSoFar === 0 && current.length === 0 && index === 0,
          status: 'ready' as const,
        }));
      return [...current, ...fresh];
    });
  }

  async function uploadAll() {
    setUploading(true);
    let added = 0;
    for (const pair of pairs.filter((candidate) => candidate.status !== 'done')) {
      setPairs((current) =>
        current.map((item) => (item.id === pair.id ? { ...item, status: 'uploading', message: undefined } : item))
      );
      try {
        await problemsApi.addTest(target, pair.input, pair.output, pair.sample, {
          input: pair.input.name,
          output: pair.output.name,
        });
        added++;
        setPairs((current) => current.map((item) => (item.id === pair.id ? { ...item, status: 'done' } : item)));
      } catch (caught) {
        setPairs((current) =>
          current.map((item) =>
            item.id === pair.id ? { ...item, status: 'error', message: uploadFailureMessage(caught) } : item
          )
        );
        // A limit means every later upload would fail the same way.
        if (caught instanceof ApiError && caught.status === 409) break;
      }
    }
    setUploading(false);
    if (added > 0) {
      await onChanged();
      toast({ tone: 'success', title: added === 1 ? 'Added 1 test' : `Added ${added} tests` });
      setPairs((current) => current.filter((item) => item.status !== 'done'));
    }
  }

  const waiting = pairs.filter((pair) => pair.status !== 'done').length;
  const oversized = (file: File, sample: boolean) => file.size > maxFileBytes || (sample && file.size > maxSampleBytes);

  return (
    <section
      aria-labelledby="add-heading"
      className="border-border bg-surface flex flex-col gap-4 rounded-md border p-4"
    >
      <h2 id="add-heading" className="text-h3">
        Add tests
      </h2>
      <Tabs defaultValue="files" className="flex flex-col gap-4">
        <TabsList aria-label="How to add tests">
          <TabsTrigger value="files">Upload files</TabsTrigger>
          <TabsTrigger value="paste">Paste text</TabsTrigger>
        </TabsList>

        <TabsContent value="files" className="flex flex-col gap-4">
          <label
            htmlFor="test-files"
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              addFiles(Array.from(event.dataTransfer.files));
            }}
            className={cn(
              'border-border-strong text-small flex cursor-pointer flex-col items-center gap-1 rounded-md border border-dashed p-6 text-center',
              dragging && 'bg-primary-soft'
            )}
          >
            <Upload className="text-text-muted size-5" strokeWidth={1.75} aria-hidden />
            <span className="text-body-strong">Drop input and output files here, or choose them</span>
            <span className="text-text-muted">
              Pairs are matched by name: <span className="vd-mono">1.in</span> with{' '}
              <span className="vd-mono">1.out</span> (or <span className="vd-mono">.ans</span>). UTF-8 text, up to{' '}
              {formatBytes(maxFileBytes)} each.
            </span>
          </label>
          <input
            id="test-files"
            ref={files}
            type="file"
            multiple
            className="vd-sr"
            onChange={(event) => {
              addFiles(Array.from(event.target.files ?? []));
              event.target.value = '';
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => files.current?.click()}>
              Choose files
            </Button>
            <Button size="sm" onClick={() => folder.current?.click()}>
              Choose a folder
            </Button>
            <input
              ref={folder}
              type="file"
              multiple
              className="vd-sr"
              tabIndex={-1}
              aria-label="Choose a folder of tests"
              {...({ webkitdirectory: '' } as Record<string, string>)}
              onChange={(event) => {
                addFiles(Array.from(event.target.files ?? []));
                event.target.value = '';
              }}
            />
          </div>

          {unpaired.length > 0 && (
            <div role="alert" className="bg-warning-soft text-small rounded-md p-3">
              <p className="text-warning text-body-strong">These files were left out:</p>
              <ul className="list-disc pl-5">
                {unpaired.map((item) => (
                  <li key={item.name + item.reason}>
                    <span className="vd-mono">{item.name}</span>: {item.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {pairs.length > 0 && (
            <>
              <div className="vd-tablewrap">
                <table className="vd-table">
                  <caption className="vd-sr">Tests ready to upload</caption>
                  <thead>
                    <tr>
                      <th scope="col">Name</th>
                      <th scope="col">Input</th>
                      <th scope="col">Output</th>
                      <th scope="col">Sample</th>
                      <th scope="col">Status</th>
                      <th scope="col">
                        <span className="vd-sr">Remove</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pairs.map((pair) => (
                      <tr key={pair.id}>
                        <td className="vd-mono">{pair.name}</td>
                        <td>
                          <span className="vd-mono">{pair.input.name}</span>{' '}
                          <span className="text-text-muted">({formatBytes(pair.input.size)})</span>
                        </td>
                        <td>
                          <span className="vd-mono">{pair.output.name}</span>{' '}
                          <span className="text-text-muted">({formatBytes(pair.output.size)})</span>
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            checked={pair.sample}
                            disabled={pair.status === 'uploading' || pair.status === 'done'}
                            aria-label={`${pair.name} is a sample`}
                            onChange={(event) =>
                              setPairs((current) =>
                                current.map((item) =>
                                  item.id === pair.id ? { ...item, sample: event.target.checked } : item
                                )
                              )
                            }
                          />
                        </td>
                        <td className="text-small max-w-sm min-w-48 break-words whitespace-normal">
                          {pair.status === 'ready' &&
                            (oversized(pair.input, pair.sample) || oversized(pair.output, pair.sample) ? (
                              <span className="text-warning">Too large{pair.sample ? ' for a sample' : ''}</span>
                            ) : (
                              'Ready'
                            ))}
                          {pair.status === 'uploading' && 'Uploading…'}
                          {pair.status === 'done' && 'Added'}
                          {pair.status === 'error' && (
                            <span role="alert" className="text-danger">
                              {pair.message}
                            </span>
                          )}
                        </td>
                        <td>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={uploading}
                            aria-label={`Remove ${pair.name} from the list`}
                            onClick={() => setPairs((current) => current.filter((item) => item.id !== pair.id))}
                          >
                            Remove
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={uploadAll} disabled={uploading || waiting === 0}>
                  <Upload aria-hidden />
                  {uploading ? 'Uploading…' : waiting === 1 ? 'Upload 1 test' : `Upload ${waiting} tests`}
                </Button>
                <Button variant="ghost" onClick={() => setPairs([])} disabled={uploading}>
                  Clear list
                </Button>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="paste">
          <PasteTest samplesSoFar={samplesSoFar} onAdded={onChanged} />
        </TabsContent>
      </Tabs>
    </section>
  );
}

function PasteTest({ samplesSoFar, onAdded }: { samplesSoFar: number; onAdded: () => Promise<void> }) {
  const { target } = useProblemWorkspace();
  const toast = useToast();
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [sample, setSample] = useState(samplesSoFar === 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function add() {
    setSaving(true);
    setError(null);
    try {
      await problemsApi.addTest(
        target,
        new Blob([input], { type: 'text/plain' }),
        new Blob([output], { type: 'text/plain' }),
        sample,
        {
          input: 'pasted input',
          output: 'pasted output',
        }
      );
      setInput('');
      setOutput('');
      setSample(false);
      await onAdded();
      toast({ tone: 'success', title: 'Added 1 test' });
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 400) setError(caught);
      else toast({ tone: 'danger', title: 'Could not add the test', description: uploadFailureMessage(caught) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <TextField
          label="Input"
          multiline
          mono
          rows={6}
          value={input}
          error={error?.fieldError('input')}
          onChange={(event) => setInput(event.target.value)}
        />
        <TextField
          label="Expected output"
          multiline
          mono
          rows={6}
          value={output}
          error={error?.fieldError('output')}
          onChange={(event) => setOutput(event.target.value)}
        />
      </div>
      <label className="text-body flex items-center gap-2">
        <input type="checkbox" checked={sample} onChange={(event) => setSample(event.target.checked)} />
        Show to solvers as a sample
      </label>
      <div>
        <Button onClick={add} disabled={saving || (input === '' && output === '')}>
          {saving ? 'Adding…' : 'Add test'}
        </Button>
      </div>
    </div>
  );
}

function ReplaceDialog({
  test,
  onClose,
  onReplace,
}: {
  test: TestCase | null;
  onClose: () => void;
  onReplace: (files: { input?: File; output?: File }) => Promise<void>;
}) {
  const [input, setInput] = useState<File | undefined>();
  const [output, setOutput] = useState<File | undefined>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | string | null>(null);
  const position = test?.position;
  const apiError = useMemo(() => (error instanceof ApiError ? error : null), [error]);

  return (
    <Dialog
      open={test !== null}
      onClose={onClose}
      title={`Replace files of test ${position ?? ''}`}
      description="Choose a new input, a new output, or both. The position and the sample setting stay."
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={saving || (!input && !output)}
            onClick={async () => {
              setSaving(true);
              setError(null);
              try {
                await onReplace({ input, output });
              } catch (caught) {
                setError(caught instanceof ApiError ? caught : errorMessage(caught));
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? 'Replacing…' : 'Replace'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <label className="vd-field">
          <span className="vd-label">New input file</span>
          <input type="file" onChange={(event) => setInput(event.target.files?.[0])} />
          {apiError?.fieldError('input') && (
            <span className="vd-hint vd-hint--error">{apiError.fieldError('input')}</span>
          )}
        </label>
        <label className="vd-field">
          <span className="vd-label">New output file</span>
          <input type="file" onChange={(event) => setOutput(event.target.files?.[0])} />
          {apiError?.fieldError('output') && (
            <span className="vd-hint vd-hint--error">{apiError.fieldError('output')}</span>
          )}
        </label>
        {error && !apiError?.details?.length && (
          <p role="alert" className="vd-hint vd-hint--error">
            {typeof error === 'string' ? error : error.message}
          </p>
        )}
      </div>
    </Dialog>
  );
}
