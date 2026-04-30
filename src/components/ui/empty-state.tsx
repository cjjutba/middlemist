import type { ComponentType, ReactNode } from 'react';

type Props = {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <div className="border-hairline-soft bg-surface-card rounded-lg border px-8 py-16 text-center">
      {Icon ? (
        <div className="text-muted-soft mx-auto mb-4 flex h-12 w-12 items-center justify-center">
          <Icon className="h-8 w-8" />
        </div>
      ) : null}
      <h2 className="font-display text-ink text-[28px] font-semibold tracking-[-0.5px]">{title}</h2>
      {description ? (
        <p className="text-muted mx-auto mt-3 max-w-md text-[16px] leading-[1.5]">{description}</p>
      ) : null}
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}
