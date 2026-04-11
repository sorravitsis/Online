# SiS Warehouse Design System

## Color Token Architecture

```
Layer 1: Background    — ink-50, subtle red radial gradients
Layer 2: Cards         — white/97% opacity, glass blur, card shadow
Layer 3: Elevated      — full white, red-100 border, elevated shadow (red tint)
Layer 4: Interactive   — red gradient buttons, inner-glow inputs
Layer 5: Accents       — red-600 primary, ink-900 headings
```

## How to import into Figma

1. Install **Tokens Studio for Figma** plugin
2. Open plugin → Settings → Add new → URL/File
3. Point to `design/tokens.json` in this repo
4. Apply tokens → all color variables, typography, and shadows will sync

## Quick reference

| Token | Value | Usage |
|-------|-------|-------|
| `red-600` | `#dc2626` | Primary brand, buttons, links |
| `red-500` | `#ef4444` | Gradient start, hover states |
| `red-700` | `#b91c1c` | Gradient end, pressed states |
| `red-100` | `#fee2e2` | Card borders (elevated), alerts |
| `red-50` | `#fef2f2` | Error backgrounds, subtle tints |
| `ink-900` | `#0f172a` | Headings, high-contrast text |
| `ink-600` | `#475569` | Body text |
| `ink-400` | `#94a3b8` | Labels, captions |
| `ink-200` | `#e2e8f0` | Borders, dividers |
| `ink-50` | `#f8fafc` | Page background |

## Shadow system

| Name | Purpose |
|------|---------|
| `card` | Default card — barely visible, clean |
| `card-hover` | On hover — slightly more depth |
| `elevated` | Hero sections, modals — red-tinted |
| `glow-red` | Primary button hover — soft red halo |
| `inner-glow` | Inputs — subtle inset white highlight |

## Component tokens

Pre-defined component styles in `tokens.json` under `components`:
- `button-primary` — gradient red CTA
- `button-secondary` — outlined neutral
- `card-glass` — glass morphism surface
- `card-elevated` — hero/modal surface
- `input` — text fields
- `badge` — status indicators
- `wordmark-badge` — SiS brand mark
