import { cn } from '@/lib/utils/cn';

type Tone = 'neutral' | 'success' | 'warning' | 'error' | 'muted';

const PALETTE: Record<Tone, string> = {
  neutral: 'bg-surface-card text-ink',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  error: 'bg-error/10 text-error',
  muted: 'bg-surface-soft text-muted',
};

export function StatusPill({
  tone = 'neutral',
  children,
}: {
  tone?: Tone;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        'rounded-pill inline-flex items-center px-2.5 py-0.5 text-[12px] font-medium',
        PALETTE[tone],
      )}
    >
      {children}
    </span>
  );
}
