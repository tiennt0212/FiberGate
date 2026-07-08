"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Alert, Button, Card, Input } from "antd";

import { login, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="primary"
      htmlType="submit"
      loading={pending}
      block
      className="h-auto! rounded-md! bg-accent! py-1.75! text-[13px]! font-medium! hover:bg-accent-hover!"
    >
      Sign in
    </Button>
  );
}

export default function LoginPage() {
  const [state, formAction] = useFormState(login, initialState);

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <Card
        className="w-full max-w-90 rounded-lg! border-border!"
        styles={{ body: { padding: "28px 24px" } }}
      >
        <h1 className="mb-1 text-[18px] font-semibold text-text-primary">FiberGate</h1>
        <p className="mb-6 text-[13px] text-text-muted">Sign in to the merchant dashboard</p>

        {state.error ? (
          <Alert type="error" showIcon message={state.error} className="mb-4 rounded-md!" />
        ) : null}

        <form action={formAction}>
          <label htmlFor="password" className="mb-1.5 block text-[13px] text-text-secondary">
            Password
          </label>
          <Input.Password
            id="password"
            name="password"
            required
            autoFocus
            className="mb-4 rounded-md!"
          />
          <SubmitButton />
        </form>
      </Card>
    </main>
  );
}
