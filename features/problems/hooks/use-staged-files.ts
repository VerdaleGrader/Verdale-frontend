'use client';

import { useCallback, useRef, useState } from 'react';
import type { UploadFile } from '@/components/ui/file-uploader';
import { formatBytes } from '@/lib/format';
import { problemsApi, type ProblemTarget } from '../api/problems.api';
import { uploadFailureMessage } from '../upload-message';
import type { StagedFile } from '../types';

export interface StagedItem extends UploadFile {
  file: File;
  /** What Core answered once it stored the file. */
  staged?: StagedFile;
}

const PARALLEL = 4;

/**
 * Files chosen for the testcases page: each is checked against the size limit, sent to Core to be stored (Core
 * checks it is text and normalises it) and shown with its status. Nothing is saved with the problem yet.
 */
export function useStagedFiles(
  target: ProblemTarget,
  { maxFileBytes, multiple }: { maxFileBytes: number; multiple: boolean }
) {
  const [items, setItems] = useState<StagedItem[]>([]);
  const counter = useRef(0);

  const patch = useCallback(
    (id: string, change: Partial<StagedItem>) =>
      setItems((current) => current.map((item) => (item.id === id ? { ...item, ...change } : item))),
    []
  );

  const add = useCallback(
    (files: File[]) => {
      const fresh: StagedItem[] = files.map((file) => ({
        id: `file-${counter.current++}`,
        name: file.webkitRelativePath || file.name,
        size: file.size,
        file,
        status: file.size > maxFileBytes ? 'rejected' : 'uploading',
        message: file.size > maxFileBytes ? `Too large: at most ${formatBytes(maxFileBytes)}.` : undefined,
      }));
      setItems((current) => (multiple ? [...current, ...fresh] : fresh));
      const queue = fresh.filter((item) => item.status === 'uploading');
      // A few at a time: a folder can hold hundreds of files.
      const worker = async () => {
        for (let item = queue.shift(); item; item = queue.shift()) {
          try {
            const staged = await problemsApi.stageFile(target, item.file);
            patch(item.id, { status: 'done', staged });
          } catch (caught) {
            patch(item.id, { status: 'error', message: uploadFailureMessage(caught) });
          }
        }
      };
      void Promise.all(Array.from({ length: Math.min(PARALLEL, queue.length) }, worker));
    },
    [maxFileBytes, multiple, patch, target]
  );

  return {
    items,
    add,
    remove: useCallback((id: string) => setItems((current) => current.filter((item) => item.id !== id)), []),
    clear: useCallback(() => setItems([]), []),
    busy: items.some((item) => item.status === 'uploading'),
  };
}
