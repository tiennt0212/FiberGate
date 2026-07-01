import { redirect } from "next/navigation";

// Middleware normally handles "/" — this is the fallback if it ever renders.
export default function RootPage() {
  redirect("/dashboard");
}
