import { cn } from '@/lib/utils/cn';

type Props = {
  current: number;
  total: number;
};

/**
 * Progress dots for the onboarding flow. The full nav-pill-group from
 * docs/design/component-patterns.md will replace this when settings ships
 * with its own step UI; for v1 a horizontal progress indicator is fine.
 */
export function OnboardingStepper({ current, total }: Props) {
  return (
    <div className="mb-6 flex items-center justify-center gap-2">
      {Array.from({ length: total }).map((_, i) => {
        const stepNum = i + 1;
        const isActive = stepNum === current;
        const isPast = stepNum < current;
        const cls = isActive
          ? 'w-8 bg-primary'
          : isPast
            ? 'w-6 bg-primary'
            : 'w-6 bg-surface-strong';
        return (
          <div
            key={i}
            className={cn('rounded-pill h-1.5 transition-all', cls)}
            aria-label={`Step ${stepNum} of ${total}${isActive ? ' (current)' : ''}`}
          />
        );
      })}
      <p className="text-muted-soft ml-2 text-[12px] font-medium">
        {current} of {total}
      </p>
    </div>
  );
}
