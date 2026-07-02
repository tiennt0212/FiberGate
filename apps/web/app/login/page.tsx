"use client";

import { useRouter } from "next/navigation";
import { Button, Card, Form, Input, Typography } from "antd";
import { LockOutlined } from "@ant-design/icons";
import { ROUTES } from "@/lib/routes";

// Single-admin password gate. UI only — no real auth in this pure-UI build;
// submitting just navigates to the dashboard.
export default function LoginPage() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <Card
        className="w-full max-w-[400px]"
        styles={{ body: { padding: 28 } }}
      >
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent text-lg font-bold text-white">
            F
          </span>
          <Typography.Title level={4} className="mb-0!">
            Login to dashboard
          </Typography.Title>
          <Typography.Text type="secondary" className="text-[13px]">
            Enter the admin password set at deploy time
          </Typography.Text>
        </div>

        <Form
          layout="vertical"
          requiredMark={false}
          onFinish={() => router.push(ROUTES.DASHBOARD)}
        >
          <Form.Item
            label="Admin password"
            name="password"
            rules={[{ required: true, message: "Password is required" }]}
          >
            <Input.Password
              size="large"
              prefix={<LockOutlined className="text-text-subtle" />}
              placeholder="••••••••"
            />
          </Form.Item>
          <Button type="primary" size="large" htmlType="submit" block>
            Sign in
          </Button>
        </Form>
      </Card>
    </div>
  );
}
