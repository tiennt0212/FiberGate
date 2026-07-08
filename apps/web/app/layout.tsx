import type { Metadata } from 'next'
import { DM_Sans, JetBrains_Mono } from 'next/font/google'
import { AntdRegistry } from '@ant-design/nextjs-registry'
import { ConfigProvider } from 'antd'
import './globals.css'

// DESIGN.md's Font Stack (UI: DM Sans, Code: JetBrains Mono) — self-hosted via
// next/font so the app never makes a runtime request to fonts.googleapis.com
// (the mockup's <link> tag is fine for a static preview, not for a self-hosted
// product). Exposed as CSS variables consumed by globals.css's `@theme inline`
// (Tailwind's font-sans/font-mono utilities) and by the ConfigProvider below
// (Antd's own components don't read Tailwind's theme, only React props).
const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'FiberGate',
  description: 'Self-hosted merchant payment gateway for Fiber Network',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${jetbrainsMono.variable}`}>
      <body>
        <AntdRegistry>
          <ConfigProvider theme={{ token: { fontFamily: 'var(--font-dm-sans), system-ui, sans-serif' } }}>
            {children}
          </ConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  )
}
