/**
 * Monaco themes for Verdale (design system README, "Code editor"). Monaco
 * reads hex, not CSS variables, so the values live here and
 * lib/monaco-themes.test.ts fails when they drift from design/tokens.json.
 * The editor background is `surface` and the active line is `surface-sunken`.
 */
interface ThemeData {
  base: 'vs' | 'vs-dark';
  inherit: boolean;
  rules: Array<{ token: string; foreground: string; fontStyle?: string }>;
  colors: Record<string, string>;
}

/** The slice of the Monaco API we use, so this file needs no monaco import. */
export interface MonacoLike {
  editor: { defineTheme(name: string, data: ThemeData): void };
}

export const MONACO_THEME_NAMES = { light: 'verdale-light', dark: 'verdale-dark' } as const;

export const verdaleLight: ThemeData = {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'keyword', foreground: '1F6B45' },
    { token: 'string', foreground: '8A5300' },
    { token: 'number', foreground: '3B4FB0' },
    { token: 'comment', foreground: '6B756E', fontStyle: 'italic' },
    { token: 'type', foreground: 'A8235A' },
    { token: 'identifier.function', foreground: '1E5FA8' },
  ],
  colors: {
    'editor.background': '#FFFFFF',
    'editor.foreground': '#121714',
    'editor.lineHighlightBackground': '#F2EFE7',
    'editor.selectionBackground': '#CFE6D8',
    'editorLineNumber.foreground': '#5F6B63',
    'editorLineNumber.activeForeground': '#121714',
    'editorCursor.foreground': '#1F6B45',
  },
};

export const verdaleDark: ThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'keyword', foreground: '6FCF97' },
    { token: 'string', foreground: 'FFC861' },
    { token: 'number', foreground: 'A3B4FF' },
    { token: 'comment', foreground: '83908A', fontStyle: 'italic' },
    { token: 'type', foreground: 'F49AC1' },
    { token: 'identifier.function', foreground: '7CC4FF' },
  ],
  colors: {
    'editor.background': '#141A17',
    'editor.foreground': '#E8EDE9',
    'editor.lineHighlightBackground': '#0A0D0B',
    'editor.selectionBackground': '#23402F',
    'editorLineNumber.foreground': '#9AA59E',
    'editorLineNumber.activeForeground': '#E8EDE9',
    'editorCursor.foreground': '#6FCF97',
  },
};

/** Call once with the monaco instance (e.g. in @monaco-editor/react's beforeMount). */
export function defineVerdaleThemes(monaco: MonacoLike) {
  monaco.editor.defineTheme(MONACO_THEME_NAMES.light, verdaleLight);
  monaco.editor.defineTheme(MONACO_THEME_NAMES.dark, verdaleDark);
}

/** Editor options from the `code` text style: Plex Mono 14/22. */
export const MONACO_EDITOR_OPTIONS = {
  fontFamily: 'var(--font-plex-mono), "IBM Plex Mono", ui-monospace, Menlo, monospace',
  fontSize: 14,
  lineHeight: 22,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
} as const;
