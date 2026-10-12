'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { MONACO_EDITOR_OPTIONS, MONACO_THEME_NAMES, defineVerdaleThemes } from '@/lib/monaco-themes';
import { useColorScheme } from '@/lib/use-color-scheme';
import { cn } from '@/lib/utils';

// Monaco is large: it loads only on pages that show an editor, and only in the browser.
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => <p className="text-small text-text-muted p-3">Loading editor…</p>,
});

const MONACO_LANGUAGE: Record<string, string> = { c: 'c', cpp: 'cpp', python: 'python' };

/** How long Monaco may take to appear before we give the person a plain text box instead. */
const LOAD_TIMEOUT_MS = 8000;

export interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  /** c, cpp or python. */
  language: string;
  label: string;
  height?: number | string;
  readOnly?: boolean;
  /** Ctrl or ⌘ + Enter. */
  onSubmit?: () => void;
  /** Always use the plain text box (small screens, tests). */
  plain?: boolean;
  className?: string;
}

/** A plain text box that behaves like a code editor: monospace, no wrapping, Tab inserts a tab. */
function PlainEditor({ value, onChange, label, height, readOnly, onSubmit, className }: CodeEditorProps) {
  return (
    <textarea
      aria-label={label}
      className={cn('vd-input vd-input--mono vd-input--area w-full', className)}
      style={{ height, minHeight: 160, whiteSpace: 'pre', overflowX: 'auto', border: 0, borderRadius: 0 }}
      value={value}
      readOnly={readOnly}
      spellCheck={false}
      autoCapitalize="off"
      autoCorrect="off"
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
          event.preventDefault();
          onSubmit?.();
          return;
        }
        if (event.key === 'Tab' && !event.shiftKey && !readOnly) {
          event.preventDefault();
          const target = event.currentTarget;
          const { selectionStart, selectionEnd } = target;
          const next = `${value.slice(0, selectionStart)}\t${value.slice(selectionEnd)}`;
          onChange(next);
          requestAnimationFrame(() => target.setSelectionRange(selectionStart + 1, selectionStart + 1));
        }
      }}
    />
  );
}

/**
 * The code editor: Monaco with the Verdale themes, or a plain text box when
 * asked to (small screens) or when Monaco cannot load (offline, blocked CDN).
 */
export function CodeEditor(props: CodeEditorProps) {
  const { value, onChange, language, label, height = 420, readOnly, onSubmit, plain } = props;
  const scheme = useColorScheme();
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const onSubmitRef = useRef(onSubmit);
  useEffect(() => {
    onSubmitRef.current = onSubmit;
  }, [onSubmit]);

  useEffect(() => {
    if (plain || loaded) return;
    const timer = window.setTimeout(() => setFailed(true), LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [plain, loaded]);

  if (plain || failed) {
    return (
      <>
        {failed && !plain && (
          <p role="status" className="bg-warning-soft text-warning text-small px-3 py-2">
            The code editor could not load, so this is a plain text box. Your code works the same.
          </p>
        )}
        <PlainEditor {...props} />
      </>
    );
  }

  return (
    <div aria-label={label} role="group" style={{ height }}>
      <MonacoEditor
        height="100%"
        language={MONACO_LANGUAGE[language] ?? 'plaintext'}
        value={value}
        theme={scheme === 'dark' ? MONACO_THEME_NAMES.dark : MONACO_THEME_NAMES.light}
        beforeMount={(monaco) => defineVerdaleThemes(monaco)}
        onMount={(editor, monaco) => {
          setLoaded(true);
          editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => onSubmitRef.current?.());
        }}
        onChange={(next) => onChange(next ?? '')}
        options={{
          ...MONACO_EDITOR_OPTIONS,
          readOnly,
          automaticLayout: true,
          ariaLabel: label,
          tabSize: 4,
          padding: { top: 12, bottom: 12 },
        }}
      />
    </div>
  );
}
