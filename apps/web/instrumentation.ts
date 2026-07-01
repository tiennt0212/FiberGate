// Next.js calls register() once when the server process boots.
// We use it to start the in-process invoice poller (BR-POL-001) — node runtime only.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startPoller } = await import("@/lib/poller/worker");
    startPoller();
  }
}
