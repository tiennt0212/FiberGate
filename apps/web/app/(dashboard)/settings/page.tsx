import { ChangePasswordForm } from "./change-password-form";

// No data to load server-side (the form only ever writes, never reads the
// current hash back) — a plain Server Component wrapper matches
// quick-start/page.tsx's shape for pages with a single client island.

export default function SettingsPage() {
  return <ChangePasswordForm />;
}
