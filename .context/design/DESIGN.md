# FiberGate Design System

> Reference tokens, type scale, and component patterns for the FiberGate Self-Hosted Payment Gateway.
>

---

## Color Tokens

### Surface & Layout
| Token         | Hex       | Usage                              |
|---------------|-----------|------------------------------------|
| `bg`          | `#f7f7f8` | Page background                    |
| `surface`     | `#ffffff` | Cards, panels, sidebar, header     |
| `border`      | `#e4e4e7` | Card borders, table borders        |
| `border-subtle` | `#f3f4f6` | Table row dividers                 |
| `border-focus` | `#f0f0f2` | Sidebar section dividers           |

### Text
| Token           | Hex       | Usage                              |
|-----------------|-----------|------------------------------------|
| `text-primary`  | `#141414` | Body text, headings, values        |
| `text-secondary`| `#52525b` | Inactive nav items, descriptions   |
| `text-muted`    | `#71717a` | Labels, table headers, metadata    |
| `text-subtle`   | `#a1a1aa` | Timestamps, secondary captions     |
| `text-xsubtle`  | `#9898a8` | Uppercase table column headers     |

### Accent — Indigo
| Token            | Hex       | Usage                              |
|------------------|-----------|------------------------------------|
| `accent`         | `#4f46e5` | Primary CTA, active nav, links     |
| `accent-hover`   | `#4338ca` | Hover on accent buttons            |
| `accent-light`   | `#eef2ff` | Active nav bg, highlighted rows    |
| `accent-ring`    | `rgba(79,70,229,.08)` | Focus ring (current step) |

### Status Badges
| Status    | Background | Text      |
|-----------|------------|-----------|
| `paid`    | `#dcfce7`  | `#15803d` |
| `active`  | `#dcfce7`  | `#15803d` |
| `online`  | `#f0fdf4` (bg) / `#bbf7d0` (border) | `#15803d` |
| `pending` | `#fef9c3`  | `#854d0e` |
| `expired` | `#f3f4f6`  | `#374151` |
| `disabled`| `#f3f4f6`  | `#71717a` |
| `failed`  | `#fee2e2`  | `#991b1b` |

### Semantic
| Token       | Hex       | Usage                                  |
|-------------|-----------|----------------------------------------|
| `success`   | `#16a34a` | Success dot color, positive delta      |
| `warning`   | `#f59e0b` | Low capacity warning (inbound < 10 CKB) |
| `danger`    | `#dc2626` | Failed status, revoke button, negative delta |
| `purple`    | `#7c3aed` | Outbound capacity bar, gradient end    |
| `code-bg`   | `#0f172a` | Code block background (dark)           |
| `code-bg-dim` | `#1e293b` | Dimmed code block (pending steps)      |

---

## Typography

### Font Stack
```
UI:   'DM Sans', system-ui, sans-serif
Code: 'JetBrains Mono', 'Fira Code', monospace
```

### Type Scale
| Name        | Size    | Weight | Line Height | Usage                              |
|-------------|---------|--------|-------------|------------------------------------|
| `display`   | 27px    | 700    | 1.0         | Metric card values                 |
| `page-title`| 15px    | 600    | 1.3         | Page / section headings            |
| `card-title`| 13–13.5px| 600   | 1.3         | Card headers, panel titles         |
| `step-title`| 14px    | 600    | 1.3         | Quick Start step titles            |
| `body`      | 13–14px | 400    | 1.5         | Table cells, descriptions          |
| `label`     | 12–12.5px| 500   | 1.4         | Form labels, nav items active      |
| `caption`   | 11–11.5px| 400–600| 1.3        | Timestamps, sub-values, badges     |
| `col-header`| 11.5px  | 600    | 1.3         | Table column headers (UPPERCASE)   |
| `nav-item`  | 13.5px  | 400/600| —          | Sidebar nav (600 when active)      |
| `code-sm`   | 12px    | 400–500| 1.6        | Invoice IDs, payment hashes, event names |
| `code-md`   | 12.5px  | 400    | 1.6         | Code block snippets                |

---

## Spacing

Base unit: **4px**

| Name  | Value   | Usage                                           |
|-------|---------|-------------------------------------------------|
| `xs`  | 4–5px   | Gap between icon and label                      |
| `sm`  | 7–9px   | Row gap in compact lists, badge padding         |
| `md`  | 12–14px | Card inner gaps, form field gaps                |
| `lg`  | 16–18px | Card padding, section header margin             |
| `xl`  | 20–22px | Card padding (large), section spacing           |
| `2xl` | 28px    | Main content padding                            |
| `3xl` | 48–56px | Page bottom padding                             |

### Component Padding
| Component         | Padding              |
|-------------------|----------------------|
| Card (standard)   | `18px 20px`          |
| Table cell        | `11–13px 16px`       |
| Table cell (first)| `11–13px 20px`       |
| Nav button        | `7px 10px`           |
| Button (primary)  | `7px 14px`           |
| Button (small)    | `4px 9–10px`         |
| Badge (pill)      | `2px 8px`            |
| Filter button     | `6px 12px`           |

---

## Layout

| Property            | Value    |
|---------------------|----------|
| Sidebar width       | 240px    |
| Header height       | 52px     |
| Content padding     | 28px     |
| Breakpoint target   | 1280px+  |

### Sidebar Structure
1. **Logo** (56px, border-bottom) — FiberGate wordmark + node icon
2. **Navigation** (flex-1, scrollable) — grouped: Main + Setup
3. **Bottom** (auto) — Docs link + admin label

---

## Border Radius

| Element         | Radius    |
|-----------------|-----------|
| Card / panel    | `8px`     |
| Button          | `6px`     |
| Input           | `6px`     |
| Logo mark       | `8px`     |
| Badge (pill)    | `9999px`  |
| Badge (rect)    | `4px`     |
| Avatar          | `50%`     |
| Capacity bar    | `9999px`  |
| Code block      | `6px`     |

---

## Component Patterns

### Card
```
background: white
border: 1px solid #e4e4e7
border-radius: 8px
padding: 18px 20px
hover: border-color #c9c7e5
```

### Status Badge (pill)
```
display: inline-block
padding: 2px 8px
border-radius: 9999px
font-size: 11.5px
font-weight: 500
```

### Asset Tag (monospace rectangle)
```
display: inline-block
padding: 2px 8px
border-radius: 4px
font-family: JetBrains Mono
font-size: 11.5px
font-weight: 600
background: #f3f4f6
color: #374151
```

### Table
```
Header row: background #f9f9fb, border-bottom 1px solid #e4e4e7
  th: font-size 11.5px, font-weight 600, color #9898a8, uppercase, letter-spacing 0.04em
Cell: padding 11–13px 16px, border-bottom 1px solid #f3f4f6, font-size 13px
Row hover: background #f9f9fb
```

### Primary Button
```
background: #4f46e5
color: white
border: none
border-radius: 6px
padding: 7px 14px
font-size: 13px
font-weight: 500
hover: background #4338ca
```

### Secondary Button
```
background: white
color: #374151
border: 1px solid #e4e4e7
border-radius: 6px
padding: 7px 14px
font-size: 13px
hover: background #f4f4f5
```

### Danger Button (small)
```
background: #fff5f5
color: #dc2626
border: 1px solid #fca5a5
border-radius: 5px
padding: 4px 9px
font-size: 11.5px
hover: background #fee2e2
```

### Filter Button Group
```
Container: background white, border 1px solid #e4e4e7, border-radius 6px, overflow hidden
Button active: background #4f46e5, color white
Button inactive: background white, color #52525b
Divider: border-right 1px solid #e4e4e7
```

### Capacity Bar
```
Track: height 5px, background #f3f4f6, border-radius 9999px
Inbound fill:  background #4f46e5
Outbound fill: background #7c3aed
```

### Code Block
```
background: #0f172a
border-radius: 6px
padding: 12–14px 16px
font-family: JetBrains Mono
font-size: 12–12.5px
line-height: 1.6–1.65
color: #e2e8f0
overflow-x: auto
```

### Warning Banner
```
background: #fffbeb
border: 1px solid #fde68a
border-radius: 8px
padding: 12px 16px
icon stroke: #d97706
title: font-size 13px, font-weight 600, color #92400e
body: font-size 12.5px, color #a16207
```

### Node Status Indicator
```
background: #f0fdf4
border: 1px solid #bbf7d0
border-radius: 6px
dot: 8px, background #16a34a, animation pulse-dot 2s
```

---

## Animations

```css
/* Pulsing status dot */
@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
}

/* Screen transition */
@keyframes fade-in {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

---

## Invoice Status Reference

| Status    | Meaning                                  | Badge         |
|-----------|------------------------------------------|---------------|
| `paid`    | Payment received and confirmed           | Green pill    |
| `pending` | Awaiting payment                         | Amber pill    |
| `expired` | Payment window elapsed                   | Gray pill     |
| `failed`  | Payment attempt failed                   | Red pill      |

## Asset Types

| Symbol | Name  | Notes                    |
|--------|-------|--------------------------|
| `CKB`  | CKByte | Native CKB token        |
| `RUSD` | RGB USD | Stablecoin on RGB++    |

*(extensible — add new asset symbols to the Asset filter group)*

---

*Generated: Jul 01, 2026 · FiberGate Self-Hosted Payment Gateway*
