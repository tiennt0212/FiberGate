"use client";

import { useState } from "react";
import { Button, message } from "antd";

import { changePassword } from "./actions";

// Colocated with page.tsx (its only caller). Plain useState + a Button
// onClick calling the Server Action directly, matching
// webhooks/add-endpoint-drawer.tsx's convention (no useFormState, no
// form-action binding). Inline error under the field on failure (same as
// add-endpoint-drawer.tsx); success uses antd's message toast, matching
// webhooks-panel.tsx's convention for action feedback with no follow-on UI
// state to reflect.

const FIELD_CLASS =
  "w-full rounded-md border border-border px-2.5 py-2 text-[13px] text-text-primary outline-none";
const LABEL_CLASS = "mb-1.5 block text-[12px] font-medium text-text-strong";

const INITIAL_FORM = { current: "", next: "", confirm: "" };

export function ChangePasswordForm() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function setField(field: keyof typeof INITIAL_FORM, value: string): void {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(): void {
    setError(null);
    if (form.next !== form.confirm) {
      setError("New password and confirmation do not match.");
      return;
    }

    setSubmitting(true);
    changePassword(form.current, form.next)
      .then((result) => {
        if (result.ok) {
          setForm(INITIAL_FORM);
          void message.success("Password updated.");
        } else {
          setError(result.error ?? "Could not change the password.");
        }
      })
      .catch((submitError: unknown) => {
        console.error("ChangePasswordForm: changePassword failed:", submitError);
        setError("Could not change the password.");
      })
      .finally(() => setSubmitting(false));
  }

  return (
    <div className="max-w-md rounded-lg border border-border bg-white px-5 py-4.5">
      <div className="mb-4 text-[13.5px] font-semibold text-text-primary">Change Password</div>
      <div className="flex flex-col gap-4">
        <div>
          <label className={LABEL_CLASS}>Current password</label>
          <input
            type="password"
            value={form.current}
            onChange={(e) => setField("current", e.target.value)}
            className={FIELD_CLASS}
          />
        </div>
        <div>
          <label className={LABEL_CLASS}>New password</label>
          <input type="password" value={form.next} onChange={(e) => setField("next", e.target.value)} className={FIELD_CLASS} />
          <div className="mt-1.5 text-[12px] text-text-subtle">8–72 characters.</div>
        </div>
        <div>
          <label className={LABEL_CLASS}>Confirm new password</label>
          <input
            type="password"
            value={form.confirm}
            onChange={(e) => setField("confirm", e.target.value)}
            className={FIELD_CLASS}
          />
        </div>
        {error ? <div className="text-[12px] text-danger">{error}</div> : null}
        <div className="flex justify-end">
          <Button
            type="primary"
            loading={submitting}
            onClick={handleSubmit}
            className="h-auto! rounded-md! bg-accent! px-4! py-2! hover:bg-accent-hover!"
          >
            Update Password
          </Button>
        </div>
      </div>
    </div>
  );
}
