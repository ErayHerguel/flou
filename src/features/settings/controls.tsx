import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (on: boolean) => void; label: string; hint?: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 py-2">
      <span className="min-w-0 flex-1">
        <span className="block text-sm">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-faint">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx('relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors', checked ? 'bg-accent' : 'bg-active')}
      >
        <span className={cx('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-[left]', checked ? 'left-[18px]' : 'left-0.5')} />
      </button>
    </label>
  );
}

export function Heading({ children }: { children: ReactNode }) {
  return <h3 className="mb-2 text-xs font-medium text-faint">{children}</h3>;
}

export function Button({
  onClick,
  children,
  primary,
  disabled,
}: {
  onClick: () => void;
  children: ReactNode;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cx(
        'flex h-8 items-center gap-1.5 rounded-md px-3 text-sm disabled:opacity-50',
        primary ? 'bg-accent font-medium text-accent-fg' : 'border border-border hover:bg-hover',
      )}
    >
      {children}
    </button>
  );
}

