import * as React from 'react';

type Tone = 'error' | 'success' | 'info';

const styles: Record<Tone, string> = {
  error: 'bg-error/10 text-error border-error/30',
  success: 'bg-success/10 text-success border-success/30',
  info: 'bg-surface-card text-ink border-hairline',
};

export function AuthAlert({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <div className={`mb-4 rounded-md border px-4 py-3 text-[14px] leading-[1.5] ${styles[tone]}`}>
      {children}
    </div>
  );
}
