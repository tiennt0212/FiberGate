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
      className="h-auto! rounded-[6px]! bg-[#4f46e5]! py-[7px]! text-[13px]! font-medium! hover:bg-[#4338ca]!"
    >
      Sign in
    </Button>
  );
}

export default function LoginPage() {
  const [state, formAction] = useFormState(login, initialState);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f7f8] px-4">
      <Card
        className="w-full max-w-[360px] rounded-[8px]! border-[#e4e4e7]!"
        styles={{ body: { padding: "28px 24px" } }}
      >
        <h1 className="mb-1 text-[18px] font-semibold text-[#141414]">FiberGate</h1>
        <p className="mb-6 text-[13px] text-[#71717a]">Sign in to the merchant dashboard</p>

        {state.error ? (
          <Alert type="error" showIcon message={state.error} className="mb-4 rounded-[6px]!" />
        ) : null}

        <form action={formAction}>
          <label htmlFor="password" className="mb-1.5 block text-[13px] text-[#52525b]">
            Password
          </label>
          <Input.Password
            id="password"
            name="password"
            required
            autoFocus
            className="mb-4 rounded-[6px]!"
          />
          <SubmitButton />
        </form>
      </Card>
    </main>
  );
}
