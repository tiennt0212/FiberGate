// Dark code block (DESIGN.md → "Code Block"). Server-safe (no client state).
export function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-md bg-code-bg px-4 py-3 font-mono text-[12.5px] leading-relaxed text-[#e2e8f0]">
      <code>{children}</code>
    </pre>
  );
}
