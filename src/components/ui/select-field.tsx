'use client';

import { forwardRef, useId, type SelectHTMLAttributes, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
  children: ReactNode;
};

export const SelectField = forwardRef<HTMLSelectElement, Props>(function SelectField(
  { label, error, hint, id, className, children, ...rest },
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
      <div className="relative">
        <select
          ref={ref}
          id={fieldId}
          aria-invalid={Boolean(error)}
          {...(helpId ? { 'aria-describedby': helpId } : {})}
          className={cn(
            'bg-canvas text-ink h-10 w-full appearance-none rounded-md border pr-10 pl-3.5 text-[16px]',
            'transition-colors focus:outline-none',
            error ? 'border-error focus:border-error' : 'border-hairline focus:border-primary',
            className,
          )}
          {...rest}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden
          className="text-muted pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2"
        />
      </div>
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
