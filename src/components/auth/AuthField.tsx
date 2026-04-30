import * as React from 'react';

type Props = {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  defaultValue?: string;
  error?: string;
};

export function AuthField({
  label,
  name,
  type = 'text',
  autoComplete,
  required,
  defaultValue,
  error,
}: Props) {
  return (
    <label className="block">
      <span className="text-ink mb-1.5 block text-[14px] font-medium">{label}</span>
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        defaultValue={defaultValue}
        className="bg-canvas border-hairline text-ink placeholder:text-muted focus:border-primary w-full rounded-md border px-3.5 py-2.5 text-[16px] leading-[1.5] outline-none focus:ring-2 focus:ring-black/10"
      />
      {error ? <span className="text-error mt-1 block text-[13px]">{error}</span> : null}
    </label>
  );
}
