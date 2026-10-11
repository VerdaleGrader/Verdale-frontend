import type { Language } from '@/features/problems/types';

/** What the editor starts with, so a new solver sees how to read input. */
export const STARTER_CODE: Record<Language, string> = {
  c: `#include <stdio.h>

int main(void) {
    return 0;
}
`,
  cpp: `#include <iostream>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    return 0;
}
`,
  python: `import sys


def main():
    data = sys.stdin.read().split()


main()
`,
};

/** The key under which unfinished code is remembered in this browser. */
export const codeStorageKey = (space: string, problem: string, language: string) =>
  `verdale:code:${space}/${problem}:${language}`;

export const languageStorageKey = (space: string, problem: string) => `verdale:language:${space}/${problem}`;
