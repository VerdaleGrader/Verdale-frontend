import { Play, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dropdown, type DropdownOption } from '@/components/ui/dropdown';
import { Tooltip } from '@/components/ui/tooltip';

/**
 * Frame around the code editor on the solve page: language and actions above,
 * the editor inside (mount Monaco as children), judging status below. Submit is
 * the page's one primary button; Run samples is secondary.
 */
export function CodeEditorFrame({
  languages,
  language,
  onLanguageChange,
  onRun,
  running,
  onSubmit,
  submitting,
  submitLabel = 'Submit',
  submitDisabled,
  children,
  status,
}: {
  languages: DropdownOption[];
  language: string;
  onLanguageChange?: (language: string) => void;
  onRun?: () => void;
  running?: boolean;
  onSubmit?: () => void;
  submitting?: boolean;
  /** Replaces "Submit", e.g. "Log in to submit". */
  submitLabel?: string;
  submitDisabled?: boolean;
  children?: React.ReactNode;
  status?: React.ReactNode;
}) {
  return (
    <section className="vd-editor" aria-label="Code editor">
      <div className="vd-editor__bar">
        <Dropdown
          aria-label="Language"
          size="sm"
          className="vd-editor__lang"
          options={languages}
          value={language}
          onValueChange={onLanguageChange}
        />
        <div className="vd-editor__actions">
          {onRun && (
            <Tooltip label="Run samples (Ctrl or ⌘ + ')" side="bottom">
              <Button size="sm" onClick={onRun} disabled={running || submitting}>
                <Play aria-hidden />
                {running ? 'Running…' : 'Run samples'}
              </Button>
            </Tooltip>
          )}
          <Tooltip label="Submit (Ctrl or ⌘ + Enter)" side="bottom">
            <Button variant="primary" size="sm" onClick={onSubmit} disabled={running || submitting || submitDisabled}>
              <Send aria-hidden />
              {submitting ? 'Submitting…' : submitLabel}
            </Button>
          </Tooltip>
        </div>
      </div>
      <div className="vd-editor__body">{children}</div>
      {status && <div className="vd-editor__foot">{status}</div>}
    </section>
  );
}
