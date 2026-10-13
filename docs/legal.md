# Terms and Privacy Policy (GRD-122)

Two pages, `/terms` and `/privacy`, open to everyone, and a full-page notice at `/accept-terms` for signed-in people who have not accepted the current versions. The text is Thai only and lives in two files, so the reviewed final version (GRD-121) replaces them without touching code.

| What                               | Where                                                                                        |
| ---------------------------------- | -------------------------------------------------------------------------------------------- |
| Text of the documents              | `content/legal/terms.md`, `content/legal/privacy.md` (kept verbatim: excluded from Prettier) |
| Version shown by this build        | `lib/legal.ts` (`LEGAL_VERSIONS`), the document's effective date `YYYY-MM-DD`                |
| Version Core requires              | Core's `src/constants/legal.ts` (`CURRENT_LEGAL_VERSIONS`)                                   |
| Pages                              | `app/terms/page.tsx`, `app/privacy/page.tsx` (static, read the files at build time)          |
| Footer on every page               | `components/layout/site-footer.tsx`, in `app/layout.tsx`                                     |
| Sentence under the sign-in buttons | `features/auth/components/consent-note.tsx`                                                  |
| Notice, gate and API call          | `features/legal/`                                                                            |

## Publishing a new version of a document

1. Replace the text in `content/legal/<document>.md`. Keep the format: `# Title`, then `## 1. Heading` per numbered section, and the effective date as the last line ("… ตั้งแต่วันที่ 13 ตุลาคม 2569").
2. Set the document's version in `lib/legal.ts` to that effective date.
3. Set the same date in Core's `src/constants/legal.ts`.
4. Deploy Core and Frontend together. Everyone signed in is then sent to `/accept-terms` once; `lib/legal.test.ts` fails if the file's last line and the version disagree.

If only one of the two sides is changed, accepting fails with `409 LEGAL_VERSION_CHANGED` (Core compares the versions this page sends with its own), so a wrong version is never recorded.

## Rules this keeps

- No cookies beyond the necessary ones, no advertising, no third-party analytics: `lib/legal.test.ts` fails if a known tracker is added as a dependency or loaded from the source. Adding one means changing the Privacy Policy first.
- Nothing about a person is stored for the acceptance except the document, its version and the time (Core's `legal_acceptances`).
