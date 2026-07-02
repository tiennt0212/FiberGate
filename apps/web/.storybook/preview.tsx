import React from 'react'
import type { Preview } from '@storybook/nextjs-vite'
import { ConfigProvider } from 'antd'
import { theme } from '../app/theme'
import { tokensToCss } from '../lib/design-tokens'
import '../app/globals.css'

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
       color: /(background|color)$/i,
       date: /Date$/i,
      },
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: 'todo'
    }
  },

  decorators: [
    // Same setup as app/layout.tsx: runtime CSS vars from lib/design-tokens.ts
    // + Antd theme, so stories render with the exact app styling.
    (Story) => (
      <>
        <style dangerouslySetInnerHTML={{ __html: tokensToCss() }} />
        <ConfigProvider theme={theme}>
          <Story />
        </ConfigProvider>
      </>
    ),
  ],
};

export default preview;
