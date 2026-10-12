'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Filter, search, sort, page and tab state that lives in the URL query (GRD-102).
 * The URL is the single source of truth: the browser's back and forward buttons,
 * a refresh and a shared link all give the same view. Defaults are left out of
 * the URL, and a value that does not parse silently falls back to its default.
 */

export interface UrlParam<T> {
  default: T;
  /** The value for a raw query string, or `undefined` when it is not valid. */
  parse: (raw: string) => T | undefined;
  format: (value: T) => string;
  /** A page number: changing any other parameter sends it back to its default. */
  page?: boolean;
  /** A change adds a history entry (Back returns to the previous page) instead of replacing it. */
  push?: boolean;
}

/** Ready-made parameter types. */
export const param = {
  /** Free text, such as a search box. */
  text(initial = ''): UrlParam<string> {
    return { default: initial, parse: (raw) => raw, format: (value) => value };
  },
  /** One of a fixed set, such as a status filter, a sort order or a tab. */
  oneOf<T extends string>(values: readonly T[], initial: T): UrlParam<T> {
    return {
      default: initial,
      parse: (raw) => values.find((value) => value === raw),
      format: (value) => value,
    };
  },
  /** A whole number from 1 up; pagination pushes history entries. */
  page(): UrlParam<number> {
    return {
      default: 1,
      parse: (raw) => (/^[1-9]\d{0,6}$/.test(raw) ? Number(raw) : undefined),
      format: String,
      page: true,
      push: true,
    };
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each parameter has its own value type
type Schema = Record<string, UrlParam<any>>;
type Values<S extends Schema> = { [K in keyof S]: S[K] extends UrlParam<infer T> ? T : never };

/** Parse the current query against a schema. Exported for server code and tests. */
export function readUrlQuery<S extends Schema>(schema: S, query: URLSearchParams): Values<S> {
  const values: Record<string, unknown> = {};
  for (const [key, definition] of Object.entries(schema) as Array<[string, UrlParam<unknown>]>) {
    const raw = query.get(key);
    const parsed = raw === null ? undefined : definition.parse(raw);
    values[key] = parsed === undefined ? definition.default : parsed;
  }
  return values as Values<S>;
}

export function useUrlQuery<S extends Schema>(schema: S) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const query = search.toString();

  const values = useMemo(() => readUrlQuery(schema, new URLSearchParams(query)), [schema, query]);

  const set = useCallback(
    (patch: Partial<Values<S>>) => {
      const next = new URLSearchParams(query);
      const definitions = schema as Record<string, UrlParam<unknown>>;
      const changed = Object.keys(patch).filter((key) => key in definitions);
      const apply = (key: string, value: unknown) => {
        const definition = definitions[key]!;
        const text = definition.format(value);
        if (text === definition.format(definition.default)) next.delete(key);
        else next.set(key, text);
      };
      for (const key of changed) apply(key, (patch as Record<string, unknown>)[key]);
      // A new filter, search or sort starts again from the first page.
      const touchesFilter = changed.some((key) => !definitions[key]!.page);
      if (touchesFilter) {
        for (const [key, definition] of Object.entries(definitions)) {
          if (definition.page && !changed.includes(key)) next.delete(key);
        }
      }
      if (next.toString() === query) return;
      const url = `${pathname}${next.size > 0 ? `?${next}` : ''}`;
      // Back should step through pages; narrowing a filter should not fill the history.
      const push = changed.length > 0 && changed.every((key) => definitions[key]!.push);
      if (push) router.push(url, { scroll: false });
      else router.replace(url, { scroll: false });
    },
    [pathname, query, router, schema]
  );

  /** Whether any filter, search or sort differs from its default (the page does not count). */
  const filtered = useMemo(
    () =>
      (Object.entries(schema) as Array<[string, UrlParam<unknown>]>).some(
        ([key, definition]) =>
          !definition.page &&
          definition.format((values as Record<string, unknown>)[key]) !== definition.format(definition.default)
      ),
    [schema, values]
  );

  return { values, set, filtered };
}

/**
 * The text of a search box that updates the URL only after a pause in typing.
 * `committed` is the URL's value; `commit` writes a new one. The box shows what
 * was typed at once, and follows the URL when it changes some other way (Back).
 */
export function useDebouncedText(committed: string, commit: (text: string) => void, delay = 300) {
  const [draft, setDraft] = useState(committed);
  const [seen, setSeen] = useState(committed);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The timer fires later: it must call the newest `commit`, which knows the newest URL.
  const latest = useRef(commit);
  useEffect(() => {
    latest.current = commit;
  });
  useEffect(() => () => clearTimeout(timer.current ?? undefined), []);

  // The URL changed under us (Back, a link): show it, unless it is the text we just wrote.
  if (committed !== seen) {
    setSeen(committed);
    if (committed !== draft.trim()) setDraft(committed);
  }

  const onChange = useCallback(
    (text: string) => {
      setDraft(text);
      clearTimeout(timer.current ?? undefined);
      timer.current = setTimeout(() => latest.current(text.trim()), delay);
    },
    [delay]
  );

  return [draft, onChange] as const;
}
