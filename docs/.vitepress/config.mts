import { defineConfig } from "vitepress";
import { withMermaid } from "vitepress-plugin-mermaid";

export default withMermaid(
  defineConfig({
  title: "FiberGate",
  description:
    "Self-hosted CKB Fiber Network merchant payment gateway — documentation",
  base: "/FiberGate/",
  cleanUrls: true,
  themeConfig: {
    nav: [
      { text: "Merchants", link: "/merchants/quickstart" },
      { text: "Maintainers", link: "/maintainers/getting-started" },
      { text: "Reference", link: "/architecture" },
      { text: "Troubleshooting", link: "/common/troubleshooting" },
      { text: "Decisions & trade-offs", link: "/decisions-and-tradeoffs" },
    ],
    sidebar: [
      {
        text: "Merchants",
        items: [
          { text: "Quickstart for merchants", link: "/merchants/quickstart" },
          {
            text: "Manual / advanced deployment",
            link: "/merchants/deployment",
          },
          {
            text: "Public HTTPS deploy",
            link: "/merchants/public-https-deploy",
          },
          { text: "Demo storefront", link: "/merchants/demo-storefront" },
        ],
      },
      {
        text: "Maintainers",
        items: [
          {
            text: "Getting started (contributor / local dev)",
            link: "/maintainers/getting-started",
          },
          {
            text: "Paying a demo invoice locally (fiber-node-payer)",
            link: "/maintainers/local-testing",
          },
          { text: "Release process", link: "/maintainers/release-process" },
        ],
      },
      {
        text: "Common",
        items: [
          { text: "Troubleshooting", link: "/common/troubleshooting" },
          {
            text: "Environment variables",
            link: "/common/environment-variables",
          },
        ],
      },
      {
        text: "Decisions & trade-offs",
        items: [
          {
            text: "Decisions, trade-offs, and roadmap",
            link: "/decisions-and-tradeoffs",
          },
        ],
      },
      {
        text: "Reference",
        items: [
          { text: "Architecture", link: "/architecture" },
          { text: "API Reference", link: "/api-reference" },
          { text: "Glossary", link: "/glossary" },
        ],
      },
    ],
    search: { provider: "local" },
    socialLinks: [
      { icon: "github", link: "https://github.com/tiennt0212/FiberGate" },
    ],
  },
  })
);
