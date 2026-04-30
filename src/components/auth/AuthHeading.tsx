export function AuthHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-8 text-left">
      <h1 className="font-display text-ink text-[28px] leading-[1.2] font-semibold tracking-[-0.5px]">
        {title}
      </h1>
      {description ? (
        <p className="text-body mt-3 text-[16px] leading-[1.5]">{description}</p>
      ) : null}
    </div>
  );
}
