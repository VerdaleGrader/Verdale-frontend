import { readFileSync } from 'node:fs';
import path from 'node:path';
import { LEGAL_DOCUMENTS, type LegalDocumentKey } from '@/lib/legal';

export interface LegalSection {
  /** Anchor id: "section-4". */
  id: string;
  /** Heading as printed: "4. วัตถุประสงค์และฐานทางกฎหมาย". */
  title: string;
}

export interface LegalContent {
  title: string;
  /** Markdown after the title line. */
  body: string;
  sections: LegalSection[];
}

/** Anchor for a heading that starts with its number ("4. …" -> "section-4"). */
export function sectionId(heading: string): string {
  const number = /^(\d+)\./.exec(heading.trim());
  return number ? `section-${number[1]}` : `section-${heading.trim().replace(/\s+/g, '-')}`;
}

/** Splits a document file into title, body and numbered sections. Pure, so it can be tested on text. */
export function parseLegalMarkdown(markdown: string): LegalContent {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const first = lines.findIndex((line) => line.trim() !== '');
  const heading = first >= 0 ? lines[first] : undefined;
  if (!heading || !heading.startsWith('# ')) throw new Error('A legal document must start with "# Title".');
  const body = lines
    .slice(first + 1)
    .join('\n')
    .trim();
  const sections = body
    .split('\n')
    .filter((line) => line.startsWith('## '))
    .map((line) => line.slice(3).trim())
    .map((title) => ({ id: sectionId(title), title }));
  return { title: heading.slice(2).trim(), body, sections };
}

/**
 * Reads content/legal/<document>.md. Server only, and only at build time: the
 * pages are static, so nothing reads the disk while serving (Cloudflare).
 */
export function loadLegalContent(key: LegalDocumentKey): LegalContent {
  const file = path.join(process.cwd(), 'content', 'legal', LEGAL_DOCUMENTS[key].file);
  return parseLegalMarkdown(readFileSync(file, 'utf8'));
}
