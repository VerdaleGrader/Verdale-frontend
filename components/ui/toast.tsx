'use client';

import * as React from 'react';
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'success' | 'danger' | 'warning' | 'info';

export interface ToastProps {
  tone?: Tone;
  title: string;
  description?: string;
  action?: React.ReactNode;
  onDismiss?: () => void;
}

const icons = { neutral: Info, success: CircleCheck, danger: CircleAlert, warning: TriangleAlert, info: Info };

/** A transient confirmation or error. Danger toasts are alerts; the rest are polite status messages. */
export function Toast({ tone = 'neutral', title, description, action, onDismiss }: ToastProps) {
  const Icon = icons[tone];
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('vd-toast', `vd-toast--${tone}`)}>
      <Icon className="vd-toast__icon vd-icon size-4" strokeWidth={1.75} aria-hidden />
      <div className="vd-toast__body">
        <p className="vd-toast__title">{title}</p>
        {description && <p className="vd-toast__desc">{description}</p>}
        {action && <div className="mt-2">{action}</div>}
      </div>
      {onDismiss && (
        <button type="button" className="vd-iconbtn" aria-label="Dismiss" onClick={onDismiss}>
          <X className="size-4" strokeWidth={1.75} aria-hidden />
        </button>
      )}
    </div>
  );
}

interface ToastItem extends ToastProps {
  id: number;
}

const ToastContext = React.createContext<((toast: Omit<ToastProps, 'onDismiss'>) => void) | null>(null);

const AUTO_DISMISS_MS = 5000;

/** Stacks toasts bottom-right and dismisses them after 5 s unless they hold an action. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const nextId = React.useRef(1);

  const dismiss = React.useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = React.useCallback(
    (toast: Omit<ToastProps, 'onDismiss'>) => {
      const id = nextId.current++;
      setToasts((current) => [...current, { ...toast, id }]);
      if (!toast.action) window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="fixed right-4 bottom-4 left-4 z-[60] flex flex-col items-end gap-2 sm:left-auto">
        {toasts.map((toast) => (
          <Toast key={toast.id} {...toast} onDismiss={() => dismiss(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const show = React.useContext(ToastContext);
  if (!show) throw new Error('useToast must be used inside <ToastProvider>');
  return show;
}
