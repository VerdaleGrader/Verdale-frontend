'use client';

import { useMemo, useRef, useState } from 'react';
import { CircleAlert, Download, FolderOpen, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { FileUploader } from '@/components/ui/file-uploader';
import { Toggle } from '@/components/ui/toggle';
import { ApiError } from '@/lib/api';
import { formatBytes } from '@/lib/format';
import { problemsApi, type ProblemTarget } from '../api/problems.api';
import { useStagedFiles, type StagedItem } from '../hooks/use-staged-files';
import { newTest, type DraftFile, type DraftTest } from '../test-drafts';
import { pairTestFiles } from '../test-files';
import type { TestLimits } from '../types';
import { uploadFailureMessage } from '../upload-message';
import { TESTCASE_EXAMPLES } from '../examples';

const fileOf = (item: StagedItem): DraftFile => ({
  sha256: item.staged!.sha256,
  size: item.staged!.size_bytes,
  totalLines: item.staged!.total_lines,
  origin: 'upload',
  local: item.file,
});

// --- Upload files ------------------------------------------------------------

/** Upload files: choose or drop input and output files; pairs are matched by name and added to the draft. */
export function UploadPanel({
  target,
  limits,
  room,
  makeKey,
  onAdd,
  onClose,
}: {
  target: ProblemTarget;
  limits: TestLimits;
  /** How many more testcases the problem can hold. */
  room: number;
  makeKey: () => string;
  onAdd: (tests: DraftTest[]) => void;
  onClose: () => void;
}) {
  const staged = useStagedFiles(target, { maxFileBytes: limits.max_file_bytes, multiple: true });
  const folder = useRef<HTMLInputElement>(null);
  const done = useMemo(() => staged.items.filter((item) => item.status === 'done'), [staged.items]);
  const pairing = useMemo(
    () =>
      pairTestFiles(
        done.map((item) =>
          Object.assign(item, { path: item.file.webkitRelativePath || item.file.name, size: item.size })
        )
      ),
    [done]
  );
  // An input with no output is fine now: its expected output can be generated later.
  const inputsOnly = pairing.unpaired.filter(
    ({ reason, file }) => reason === 'No matching output file.' && /\.(in|inp|input)$/i.test(file.name)
  );
  const problems = pairing.unpaired.filter((entry) => !inputsOnly.includes(entry));
  const count = pairing.pairs.length + inputsOnly.length;
  const tooMany = count > room;

  function add() {
    const fromPairs = pairing.pairs.map((pair) =>
      newTest(makeKey(), fileOf(pair.input as StagedItem), fileOf(pair.output as StagedItem), false)
    );
    const fromInputs = inputsOnly.map(({ file }) => newTest(makeKey(), fileOf(file as StagedItem), null, false));
    onAdd([...fromPairs, ...fromInputs]);
  }

  return (
    <section className="tc-panel" aria-labelledby="upload-title">
      <div className="tc-panel__head">
        <div>
          <h3 className="tc-h3" id="upload-title">
            Upload testcase files
          </h3>
          <p className="tc-sub">
            Each input file with the output file of the same name becomes a new testcase at the end of the list. An
            input with no output is added too; generate its output later.
          </p>
        </div>
        <button type="button" className="vd-iconbtn" aria-label="Close upload testcase files" onClick={onClose}>
          <X className="size-4" strokeWidth={1.75} aria-hidden />
        </button>
      </div>
      <div className="flex flex-col gap-3">
        <FileUploader
          label="Upload input and output files"
          multiple
          hint={`UTF-8 text, up to ${formatBytes(limits.max_file_bytes)} each.`}
          files={staged.items}
          onFiles={staged.add}
          onRemove={staged.remove}
        />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => folder.current?.click()}>
            <FolderOpen aria-hidden />
            Choose a folder
          </Button>
          <input
            ref={folder}
            type="file"
            multiple
            className="vd-sr"
            tabIndex={-1}
            aria-label="Choose a folder of testcases"
            {...({ webkitdirectory: '' } as Record<string, string>)}
            onChange={(event) => {
              staged.add(Array.from(event.target.files ?? []));
              event.target.value = '';
            }}
          />
        </div>
        <ExampleFiles />
        {problems.length > 0 && (
          <div role="alert" className="bg-warning-soft text-small rounded-md p-3">
            <p className="text-warning text-body-strong">These files were not added:</p>
            <ul className="list-disc pl-5">
              {problems.map(({ file, reason }) => (
                <li key={(file as StagedItem).id}>
                  <span className="vd-mono">{file.name}</span>: {reason}
                </li>
              ))}
            </ul>
          </div>
        )}
        {inputsOnly.length > 0 && (
          <p className="tc-sub" style={{ margin: 0 }}>
            {inputsOnly.length} {inputsOnly.length === 1 ? 'input has' : 'inputs have'} no output file and will be added
            without an expected output.
          </p>
        )}
        {tooMany && (
          <p role="alert" className="tc-fielderr">
            <CircleAlert className="size-3.5" aria-hidden />
            This adds {count} testcases but the problem can hold {room} more. Remove some files.
          </p>
        )}
      </div>
      <div className="tc-panel__foot">
        <span className="tc-panel__foot-gap" />
        <Button size="sm" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" variant="secondary" disabled={count === 0 || tooMany || staged.busy} onClick={add}>
          {count === 1 ? 'Add 1 testcase' : `Add ${count} testcases`}
        </Button>
      </div>
    </section>
  );
}

/** Download Example: ready-made files in the shapes the page understands, and how the names are matched. */
function ExampleFiles() {
  return (
    <div className="tc-facts" style={{ gridTemplateColumns: '1fr' }}>
      <p className="m-0">
        <strong className="font-medium">How files are matched.</strong> Name the two halves of a testcase alike with
        these endings: <span className="tc-code">1.in</span> with <span className="tc-code">1.out</span> (or{' '}
        <span className="tc-code">.ans</span>), <span className="tc-code">input1.txt</span> with{' '}
        <span className="tc-code">output1.txt</span>, or put them in folders called <span className="tc-code">in</span>{' '}
        and <span className="tc-code">out</span>. Names are read without case and sorted as numbers (2 before 10).
        Verdale reads text files, not zip archives: unzip the downloads below first.
      </p>
      <ul className="tc-examples" aria-label="Download example files">
        {TESTCASE_EXAMPLES.map((example) => (
          <li key={example.href}>
            <a className="vd-link" href={example.href} download>
              <Download className="size-3.5" aria-hidden />
              {example.label}
              <span className="vd-sr">: {example.detail}</span>
            </a>
            <span className="text-text-muted text-small"> {example.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// --- Paste text --------------------------------------------------------------

interface PasteRow {
  key: number;
  input: string;
  output: string;
  visible: boolean;
  error?: string;
}

/** Paste text: a table of rows, each a new testcase. Input is required, the expected output is optional. */
export function PastePanel({
  target,
  room,
  baseCount,
  makeKey,
  onAdd,
  onClose,
}: {
  target: ProblemTarget;
  room: number;
  /** How many testcases the list has, to number the new rows. */
  baseCount: number;
  makeKey: () => string;
  onAdd: (tests: DraftTest[]) => void;
  onClose: () => void;
}) {
  const next = useRef(2);
  const [rows, setRows] = useState<PasteRow[]>([{ key: 1, input: '', output: '', visible: false }]);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);

  const patch = (key: number, change: Partial<PasteRow>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...change } : row)));
  const stage = async (text: string): Promise<DraftFile> => {
    const stored = await problemsApi.stageFile(target, { text });
    return {
      sha256: stored.sha256,
      size: stored.size_bytes,
      totalLines: stored.total_lines,
      origin: 'paste',
      local: text,
    };
  };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (rows.some((row) => row.input.trim() === '')) {
      setTried(true);
      return;
    }
    if (rows.length > room) return;
    setBusy(true);
    const added: DraftTest[] = [];
    const left: PasteRow[] = [];
    for (const row of rows) {
      try {
        const input = await stage(row.input);
        const output = row.output.trim() === '' ? null : await stage(row.output);
        added.push(newTest(makeKey(), input, output, row.visible));
      } catch (caught) {
        left.push({
          ...row,
          error:
            caught instanceof ApiError && caught.status === 413
              ? 'This text is over 1 MiB. Use Upload files.'
              : uploadFailureMessage(caught),
        });
      }
    }
    setBusy(false);
    if (added.length > 0) onAdd(added);
    if (left.length > 0) setRows(left);
  }

  return (
    <form className="tc-panel" aria-labelledby="paste-title" onSubmit={submit} noValidate>
      <div className="tc-panel__head">
        <div>
          <h3 className="tc-h3" id="paste-title">
            Paste testcases
          </h3>
          <p className="tc-sub">
            Each row becomes a new testcase at the end of the list. Leave Expected output empty to generate it from a
            solution later. For large inputs, use Upload files.
          </p>
        </div>
        <button type="button" className="vd-iconbtn" aria-label="Close paste testcases" onClick={onClose}>
          <X className="size-4" strokeWidth={1.75} aria-hidden />
        </button>
      </div>
      <div className="tc-paste" role="group" aria-label="New testcases">
        <span className="tc-paste__head tc-num">#</span>
        <span className="tc-paste__head">Input</span>
        <span className="tc-paste__head">
          Expected output <span style={{ fontWeight: 400 }}>(optional)</span>
        </span>
        <span className="tc-paste__head">Visible to solvers</span>
        <span className="tc-paste__head" />
        {rows.map((row, index) => {
          const position = baseCount + index + 1;
          const invalid = tried && row.input.trim() === '';
          return (
            <PasteRowFields
              key={row.key}
              row={row}
              position={position}
              invalid={invalid}
              onChange={(change) => patch(row.key, { ...change, error: undefined })}
              onRemove={() => setRows((current) => current.filter((candidate) => candidate.key !== row.key))}
            />
          );
        })}
      </div>
      {rows.length > room && (
        <p role="alert" className="tc-fielderr">
          <CircleAlert className="size-3.5" aria-hidden />
          The problem can hold {room} more {room === 1 ? 'testcase' : 'testcases'}. Remove some rows.
        </p>
      )}
      <div className="tc-panel__foot">
        <Button
          size="sm"
          variant="ghost"
          type="button"
          onClick={() =>
            setRows((current) => [...current, { key: next.current++, input: '', output: '', visible: false }])
          }
        >
          <Plus aria-hidden />
          Add row
        </Button>
        <span className="tc-panel__foot-gap" />
        <Button size="sm" variant="ghost" type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" variant="secondary" type="submit" disabled={rows.length === 0 || busy}>
          {busy ? 'Adding…' : rows.length === 1 ? 'Add 1 testcase' : `Add ${rows.length} testcases`}
        </Button>
      </div>
    </form>
  );
}

function PasteRowFields({
  row,
  position,
  invalid,
  onChange,
  onRemove,
}: {
  row: PasteRow;
  position: number;
  invalid: boolean;
  onChange: (change: Partial<PasteRow>) => void;
  onRemove: () => void;
}) {
  const inId = `paste-in-${row.key}`;
  const outId = `paste-out-${row.key}`;
  return (
    <>
      <span className="tc-num" style={{ paddingTop: 10 }}>
        {position}
      </span>
      <div>
        <label className="vd-sr" htmlFor={inId}>
          Input of testcase {position}
        </label>
        <textarea
          id={inId}
          className={invalid ? 'tc-cellarea is-invalid' : 'tc-cellarea'}
          rows={3}
          spellCheck={false}
          placeholder="Paste or type the input"
          value={row.input}
          aria-invalid={invalid || undefined}
          onChange={(event) => onChange({ input: event.target.value })}
        />
        {invalid && (
          <p className="tc-fielderr" role="alert">
            <CircleAlert className="size-3.5" aria-hidden />
            Enter the input, or remove this row.
          </p>
        )}
        {row.error && (
          <p className="tc-fielderr" role="alert">
            <CircleAlert className="size-3.5" aria-hidden />
            {row.error}
          </p>
        )}
      </div>
      <div>
        <label className="vd-sr" htmlFor={outId}>
          Expected output of testcase {position}
        </label>
        <textarea
          id={outId}
          className="tc-cellarea"
          rows={3}
          spellCheck={false}
          placeholder="Empty: generate later"
          value={row.output}
          onChange={(event) => onChange({ output: event.target.value })}
        />
      </div>
      <div style={{ paddingTop: 8 }}>
        <Toggle
          checked={row.visible}
          aria-label={`Visible to solvers, new testcase ${position}`}
          onCheckedChange={(checked) => onChange({ visible: checked })}
        />
      </div>
      <div style={{ paddingTop: 4 }}>
        <button type="button" className="vd-iconbtn" aria-label={`Remove new testcase ${position}`} onClick={onRemove}>
          <Trash2 className="size-4" strokeWidth={1.75} aria-hidden />
        </button>
      </div>
    </>
  );
}

// --- Replace files -----------------------------------------------------------

/** Replace files: a new input, a new output, or both. Position and visibility stay. */
export function ReplaceDialog({
  target,
  limits,
  label,
  onClose,
  onReplace,
}: {
  target: ProblemTarget;
  limits: TestLimits;
  /** "testcase 3"; null keeps the dialog closed. */
  label: string | null;
  onClose: () => void;
  onReplace: (files: { input?: DraftFile; output?: DraftFile }) => void;
}) {
  return label === null ? null : (
    <ReplaceContent target={target} limits={limits} label={label} onClose={onClose} onReplace={onReplace} />
  );
}

function ReplaceContent({
  target,
  limits,
  label,
  onClose,
  onReplace,
}: {
  target: ProblemTarget;
  limits: TestLimits;
  label: string;
  onClose: () => void;
  onReplace: (files: { input?: DraftFile; output?: DraftFile }) => void;
}) {
  const input = useStagedFiles(target, { maxFileBytes: limits.max_file_bytes, multiple: false });
  const output = useStagedFiles(target, { maxFileBytes: limits.max_file_bytes, multiple: false });
  const newInput = input.items.find((item) => item.status === 'done');
  const newOutput = output.items.find((item) => item.status === 'done');
  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={`Replace files of ${label}`}
      description="Choose a new input, a new output, or both. The position and visibility stay. The new files take effect when you save."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={(!newInput && !newOutput) || input.busy || output.busy}
            onClick={() => onReplace({ input: newInput && fileOf(newInput), output: newOutput && fileOf(newOutput) })}
          >
            Replace files
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FileUploader
          label="New input file"
          hint={`UTF-8 text, up to ${formatBytes(limits.max_file_bytes)}.`}
          files={input.items}
          onFiles={input.add}
          onRemove={input.remove}
        />
        <FileUploader
          label="New output file"
          hint={`UTF-8 text, up to ${formatBytes(limits.max_file_bytes)}.`}
          files={output.items}
          onFiles={output.add}
          onRemove={output.remove}
        />
      </div>
    </Dialog>
  );
}
