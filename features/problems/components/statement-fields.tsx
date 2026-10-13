'use client';

import { ImagePlus, Info } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { TextField } from '@/components/ui/field';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { LANGUAGE_OPTIONS, type Language, type ProblemConstraints } from '../types';
import type { DraftErrors, StatementDraft } from './statement-draft';

type Key = keyof StatementDraft;

/**
 * Title, limits and languages. The editor of an existing problem and the create page share it, so a
 * field looks and behaves the same in both. `slug` is the slug field (editable on the create page,
 * locked in the editor); it sits right under the title.
 */
export function DetailsFields({
  draft,
  constraints,
  readOnly,
  error,
  onChange,
  slug,
}: {
  draft: StatementDraft;
  constraints: ProblemConstraints;
  readOnly: boolean;
  error: (key: keyof DraftErrors) => string | undefined;
  onChange: <K extends Key>(key: K, value: StatementDraft[K]) => void;
  slug?: React.ReactNode;
}) {
  function toggleLanguage(language: Language) {
    const has = draft.languages.includes(language);
    onChange(
      'languages',
      (has ? draft.languages.filter((item) => item !== language) : [...draft.languages, language]).sort()
    );
  }

  return (
    <section aria-labelledby="details-heading" className="flex flex-col gap-4">
      <h2 id="details-heading" className="text-h2">
        Details
      </h2>
      <TextField
        label="Title"
        value={draft.title}
        maxLength={constraints.title_max_length}
        disabled={readOnly}
        error={error('title')}
        onChange={(event) => onChange('title', event.target.value)}
      />
      {slug}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Time limit (ms)"
          mono
          inputMode="numeric"
          value={draft.timeLimitMs}
          disabled={readOnly}
          hint={`Per testcase, ${constraints.time_limit_ms.min} to ${constraints.time_limit_ms.max} ms.`}
          error={error('timeLimitMs')}
          onChange={(event) => onChange('timeLimitMs', event.target.value)}
        />
        <TextField
          label="Memory limit (MB)"
          mono
          inputMode="numeric"
          value={draft.memoryLimitMb}
          disabled={readOnly}
          hint={`Per testcase, ${Math.ceil(constraints.memory_limit_kb.min / 1024)} to ${Math.floor(constraints.memory_limit_kb.max / 1024)} MB.`}
          error={error('memoryLimitMb')}
          onChange={(event) => onChange('memoryLimitMb', event.target.value)}
        />
      </div>
      <fieldset className="flex flex-col gap-2" disabled={readOnly}>
        <legend className="vd-label">Allowed languages</legend>
        <div className="mt-2 flex flex-wrap gap-4">
          {LANGUAGE_OPTIONS.filter((option) => constraints.languages.includes(option.value)).map((option) => (
            <Checkbox
              key={option.value}
              label={option.label}
              checked={draft.languages.includes(option.value)}
              onCheckedChange={() => toggleLanguage(option.value)}
            />
          ))}
        </div>
        {error('languages') && (
          <p className="vd-hint vd-hint--error" role="alert">
            {error('languages')}
          </p>
        )}
      </fieldset>
    </section>
  );
}

/** The Markdown statement with its live preview. `imageUpload` is left out where no problem exists yet. */
export function MarkdownStatementField({
  statement,
  constraints,
  readOnly,
  error,
  preview,
  onChange,
  imageUpload,
  imageDisabledReason,
  format,
}: {
  statement: string;
  constraints: ProblemConstraints;
  readOnly: boolean;
  error?: string;
  preview: React.ReactNode;
  onChange: (value: string) => void;
  /** Uploads a picture and returns the Markdown to insert. */
  imageUpload?: (file: File) => Promise<string>;
  imageDisabledReason?: string;
  /** The statement-format switch, shown between the heading and the hint. */
  format?: React.ReactNode;
}) {
  const [view, setView] = useState<'write' | 'preview'>('write');
  const [imageError, setImageError] = useState<string | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const formattingHelp = `Markdown with maths: write $a + b$ inline or $$ … $$ on its own lines. Images come from “Insert image” (PNG, JPEG or WebP, up to ${Math.round(constraints.images.max_bytes / (1024 * 1024))} MB).`;

  async function insertImage(file: File) {
    setImageError(null);
    try {
      const markdown = await imageUpload!(file);
      const area = textarea.current;
      const start = area?.selectionStart ?? statement.length;
      const end = area?.selectionEnd ?? statement.length;
      const before = statement.slice(0, start);
      const needsBreak = before.length > 0 && !before.endsWith('\n') ? '\n\n' : '';
      onChange(`${before}${needsBreak}${markdown}\n${statement.slice(end)}`);
    } catch (caught) {
      setImageError(caught instanceof Error ? caught.message : 'Could not upload the image.');
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  return (
    <section aria-labelledby="statement-heading" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 id="statement-heading" className="text-h2">
            Statement
          </h2>
          <Tooltip label={formattingHelp} side="bottom" wide>
            <Button size="icon" variant="ghost" aria-label="Formatting help">
              <Info aria-hidden />
            </Button>
          </Tooltip>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 lg:hidden" role="group" aria-label="Editor view">
            <Button
              size="sm"
              variant={view === 'write' ? 'primary' : 'secondary'}
              aria-pressed={view === 'write'}
              onClick={() => setView('write')}
            >
              Write
            </Button>
            <Button
              size="sm"
              variant={view === 'preview' ? 'primary' : 'secondary'}
              aria-pressed={view === 'preview'}
              onClick={() => setView('preview')}
            >
              Preview
            </Button>
          </div>
          <Button
            size="sm"
            disabled={readOnly || !imageUpload}
            title={imageUpload ? undefined : imageDisabledReason}
            onClick={() => fileInput.current?.click()}
          >
            <ImagePlus aria-hidden />
            Insert image
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept={constraints.images.content_types.join(',')}
            className="vd-sr"
            tabIndex={-1}
            aria-label="Choose an image to insert"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void insertImage(file);
            }}
          />
        </div>
      </div>
      {format}
      {imageError && (
        <p role="alert" className="vd-hint vd-hint--error">
          {imageError}
        </p>
      )}
      {!imageUpload && imageDisabledReason && <p className="text-small text-text-muted">{imageDisabledReason}</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={cn(view === 'write' ? 'block' : 'hidden', 'min-w-0 lg:block')}>
          <TextField
            label="Statement (Markdown)"
            multiline
            rows={22}
            mono
            value={statement}
            disabled={readOnly}
            error={error}
            onChange={(event) => onChange(event.target.value)}
            textareaRef={textarea}
          />
        </div>
        <div
          className={cn(
            view === 'preview' ? 'block' : 'hidden',
            'border-border bg-surface mt-6 min-w-0 rounded-md border p-4 lg:block'
          )}
          aria-label="Preview as a solver sees it"
        >
          {preview}
        </div>
      </div>
    </section>
  );
}
