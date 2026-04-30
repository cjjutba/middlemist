/**
 * Shared placeholder shell for sidebar-linked routes that don't have their
 * real implementation yet. Uses real design tokens so the page looks
 * intentional rather than broken; the body copy says when the module
 * arrives.
 */
export function PagePlaceholder({ title, comingIn }: { title: string; comingIn: string }) {
  return (
    <div className="px-6 py-10 lg:px-12 lg:py-14">
      <div className="mx-auto max-w-[980px]">
        <h1 className="font-display text-ink text-[32px] leading-[1.2] font-semibold tracking-[-0.5px]">
          {title}
        </h1>
        <p className="text-muted mt-3 text-[16px]">
          Coming in {comingIn}. The data model and repository foundations are in place.
        </p>
      </div>
    </div>
  );
}
