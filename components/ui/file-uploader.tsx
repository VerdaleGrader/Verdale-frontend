'use client';

import * as React from 'react';
import { CircleAlert, CircleCheck, FileText, LoaderCircle, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatBytes } from '@/lib/format';
import { cn } from '@/lib/utils';

type UploadStatus = 'uploading' | 'done' | 'error' | 'rejected';

interface UploadFile {
  id: string;
  name: string;
  size: number;
  status: UploadStatus;
  /** 0 to 100, for `uploading`. */
  progress?: number;
  /** Why it failed or was rejected: "Too large: at most 8 MiB." */
  message?: string;
}

/**
 * A drop zone with a Choose file button (the button is the keyboard and screen-reader way in; dropping is the shortcut).
 * It hands the chosen `File`s to `onFiles` and draws the files the page tells it about, each with a status:
 * uploading, done, failed or rejected. One file shows Replace and Remove; several show a list. Checking and sending
 * the files is the page's job.
 */
export function FileUploader({
  files,
  onFiles,
  onRemove,
  label = 'Upload files',
  hint,
  accept,
  multiple,
  disabled,
}: {
  files: UploadFile[];
  onFiles: (files: File[]) => void;
  onRemove?: (id: string) => void;
  label?: string;
  hint?: string;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
}) {
  const input = React.useRef<HTMLInputElement>(null);
  const [over, setOver] = React.useState(false);
  const hintId = React.useId();
  const single = !multiple && files.length === 1 ? files[0] : undefined;

  const take = (list: FileList | null) => {
    if (!list || list.length === 0 || disabled) return;
    onFiles(multiple ? Array.from(list) : [list[0]!]);
  };

  return (
    <div className="vd-uploader">
      <div
        className={cn('vd-uploader__zone', over && 'is-over', disabled && 'is-disabled')}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          take(event.dataTransfer.files);
        }}
      >
        <Upload className="vd-icon size-5" strokeWidth={1.75} aria-hidden />
        <p className="vd-uploader__title">{label}</p>
        <p id={hintId} className="text-small text-text-muted">
          Drop {multiple ? 'files' : 'a file'} here, or choose {multiple ? 'them' : 'it'}.{hint ? ` ${hint}` : ''}
        </p>
        <input
          ref={input}
          type="file"
          className="vd-sr"
          tabIndex={-1}
          aria-hidden
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          onChange={(event) => {
            take(event.target.files);
            event.target.value = '';
          }}
        />
        <Button size="sm" disabled={disabled} aria-describedby={hintId} onClick={() => input.current?.click()}>
          {single ? 'Replace file' : multiple ? 'Choose files' : 'Choose file'}
        </Button>
      </div>
      {files.length > 0 && (
        <ul className="vd-uploader__list" aria-label="Chosen files">
          {files.map((file) => (
            <li key={file.id} className={cn('vd-uploader__file', `is-${file.status}`)}>
              <StatusIcon status={file.status} />
              <span className="vd-uploader__name">
                <span className="vd-mono">{file.name}</span>
                <span className="text-small text-text-muted">
                  {formatBytes(file.size)}
                  {file.status === 'uploading' && file.progress !== undefined ? ` · ${Math.round(file.progress)}%` : ''}
                </span>
                {file.message && (
                  <span className="vd-uploader__message" role={file.status === 'done' ? undefined : 'alert'}>
                    {file.message}
                  </span>
                )}
              </span>
              {file.status === 'uploading' && file.progress !== undefined && (
                <progress
                  className="vd-uploader__bar"
                  max={100}
                  value={file.progress}
                  aria-label={`Uploading ${file.name}`}
                />
              )}
              {onRemove && (
                <button
                  type="button"
                  className="vd-iconbtn"
                  aria-label={`Remove ${file.name}`}
                  onClick={() => onRemove(file.id)}
                >
                  <X className="size-4" strokeWidth={1.75} aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: UploadStatus }) {
  if (status === 'uploading')
    return (
      <LoaderCircle className="vd-icon vd-spin text-text-muted size-4" strokeWidth={1.75} aria-label="Uploading" />
    );
  if (status === 'done')
    return <CircleCheck className="vd-icon text-brand-text size-4" strokeWidth={1.75} aria-label="Uploaded" />;
  if (status === 'error' || status === 'rejected')
    return (
      <CircleAlert
        className="vd-icon text-danger size-4"
        strokeWidth={1.75}
        aria-label={status === 'error' ? 'Upload failed' : 'Rejected'}
      />
    );
  return <FileText className="vd-icon size-4" aria-hidden />;
}

export type { UploadFile, UploadStatus };
