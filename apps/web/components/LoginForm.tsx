"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { App, Button, Form, Input } from "antd";

export function LoginForm() {
  const router = useRouter();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);

  async function onFinish(values: { password: string }) {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: values.password }),
      });
      if (res.ok) {
        router.replace("/dashboard");
        router.refresh();
      } else {
        const json = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        message.error(json?.error?.message ?? "Login failed");
      }
    } catch {
      message.error("Network error — is the gateway running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Form layout="vertical" onFinish={onFinish} requiredMark={false} className="mt-2">
      <Form.Item
        label={<span className="text-sm font-medium text-ink-2">Admin password</span>}
        name="password"
        rules={[{ required: true, message: "Enter your admin password" }]}
      >
        <Input.Password size="large" placeholder="••••••••••••" autoFocus />
      </Form.Item>
      <Button type="primary" htmlType="submit" size="large" block loading={loading}>
        Sign in
      </Button>
    </Form>
  );
}
