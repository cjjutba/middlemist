'use client';

import { forwardRef, useId, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
};

export const TextareaField = forwardRef<HTMLTextAreaElement, Props>(function TextareaField(
  { label, error, hint, id, className, rows = 3, ...rest },
  ref,
) {
  const auto = useId();
  const fieldId = id ?? rest.name ?? auto;
  const helpId = error || hint ? `${fieldId}-help` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="text-ink text-[14px] font-medium">
        {label}
      </label>
      <textarea
        ref={ref}
        id={fieldId}
        rows={rows}
        aria-invalid={Boolean(error)}
        {...(helpId ? { 'aria-describedby': helpId } : {})}
        className={cn(
          'bg-canvas text-ink placeholder:text-muted-soft min-h-24 w-full rounded-md border px-3.5 py-2.5 text-[16px] leading-[1.5]',
          'transition-colors focus:outline-none',
          error ? 'border-error focus:border-error' : 'border-hairline focus:border-primary',
          className,
        )}
        {...rest}
      />
      {(error || hint) && (
        <p
          id={helpId}
          className={cn('text-[13px] leading-[1.4]', error ? 'text-error' : 'text-muted')}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
});
