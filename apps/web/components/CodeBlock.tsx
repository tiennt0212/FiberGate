export function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-code bg-code-bg px-4 py-3 font-mono text-[12.5px] leading-relaxed text-code-text">
      <code>{children}</code>
    </pre>
  );
}
