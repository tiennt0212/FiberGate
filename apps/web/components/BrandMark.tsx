// FiberGate wordmark node icon (from .context/design mockups).
export function BrandMark({ size = 32 }: { size?: number }) {
  const inner = Math.round(size * 0.56);
  return (
    <div
      className="flex flex-shrink-0 items-center justify-center rounded-lg bg-accent"
      style={{ width: size, height: size }}
    >
      <svg width={inner} height={inner} viewBox="0 0 18 18" fill="none" aria-hidden>
        <circle cx="4.5" cy="9" r="3" fill="white" opacity=".95" />
        <circle cx="14" cy="4.5" r="2" fill="white" opacity=".7" />
        <circle cx="14" cy="13.5" r="2" fill="white" opacity=".7" />
        <line x1="7.4" y1="7.8" x2="12.1" y2="5.3" stroke="white" strokeWidth="1.1" opacity=".55" />
        <line x1="7.4" y1="10.2" x2="12.1" y2="12.7" stroke="white" strokeWidth="1.1" opacity=".55" />
      </svg>
    </div>
  );
}
