---
title: Antd interactive component catalog — check before building custom
type: gotcha
applies-to: antd v5
---

## Antd interactive component catalog

Before writing custom HTML for overlays, panels, or interactive patterns, check if Antd already ships it.

| Custom markup to avoid | Use instead |
|---|---|
| Positioned `<div>` overlay / slide-in panel | `Drawer` |
| `<details>` / `<summary>` accordion | `Collapse` |
| Custom backdrop + centered dialog | `Modal` |
| Hand-rolled dropdown list | `Select`, `Dropdown`, `Cascader` |
| Custom tab bar + panel swap | `Tabs` |
| Inline tooltip markup | `Tooltip`, `Popover` |
| Custom date input | `DatePicker`, `TimePicker` |

For usage patterns and prop APIs: see [ant.design/components](https://ant.design/components/overview). Override visual details via the `styles` prop and `className` — see `component-overrides`.

Reference: [Ant Design component list](https://ant.design/components/overview)
