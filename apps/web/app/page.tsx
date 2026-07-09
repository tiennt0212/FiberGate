import { redirect } from "next/navigation";

import { ROUTE } from "@/lib/auth/routes";

// issue #40: "/" used to render a static placeholder instead of routing
// anywhere. middleware.ts doesn't guard "/" itself, so an unauthenticated
// visitor redirected to /overview still bounces to /login from there — same
// as hitting any other guarded route directly.
export default function HomePage() {
  redirect(ROUTE.OVERVIEW);
}
