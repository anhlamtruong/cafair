# Theme Definition

This document defines the **design contract** for themes used by the app theme system.

It is the source of truth for designers and developers when creating, reviewing, and implementing a theme preset.

---

## 1) Theme Model (How the system works)

A theme is composed of:

- **Two color modes**: `light` and `dark`
- **Shared non-color style tokens** (font, radius, spacing, shadow, letter spacing)
- **Named semantic tokens** (not raw component colors)

Runtime behavior:

- Mode-specific color tokens are applied from `styles[currentMode]`
- Shared non-color tokens are applied from `styles.light`
- The root `.dark` class controls dark mode rendering
- Tokens are applied as CSS custom properties (`--token-name`)

---

## 2) Required Token Contract

Each theme mode must define the full semantic token set below.

### Core surface/content

- `background`
- `foreground`
- `card`
- `card-foreground`
- `popover`
- `popover-foreground`

### Action/interactive

- `primary`
- `primary-foreground`
- `secondary`
- `secondary-foreground`
- `accent`
- `accent-foreground`
- `muted`
- `muted-foreground`
- `destructive`
- `destructive-foreground`

### Utility/border/form

- `border`
- `input`
- `ring`

### Data visualization

- `chart-1`
- `chart-2`
- `chart-3`
- `chart-4`
- `chart-5`

### Sidebar

- `sidebar`
- `sidebar-foreground`
- `sidebar-primary`
- `sidebar-primary-foreground`
- `sidebar-accent`
- `sidebar-accent-foreground`
- `sidebar-border`
- `sidebar-ring`

### Shared typography/shape/spacing/shadow

- `font-sans`
- `font-serif`
- `font-mono`
- `radius`
- `letter-spacing`
- `spacing` (optional in schema, but recommended)
- `shadow-color`
- `shadow-opacity`
- `shadow-blur`
- `shadow-spread`
- `shadow-offset-x`
- `shadow-offset-y`

---

## 3) Value Format Rules

The engine accepts color input in:

- `oklch(...)`
- `hsl(...)`
- `rgb(...)`
- `#hex`

At apply-time, colors are normalized to Tailwind v4-compatible HSL CSS values.

Design recommendation:

- Use **OKLCH** as the canonical design value space
- Maintain perceptual consistency between light/dark modes

Non-color token examples:

- `radius`: `0.625rem`
- `letter-spacing`: `0em`
- `spacing`: `0.25rem`
- `shadow-opacity`: `0.1`
- `shadow-blur`: `3px`

---

## 4) Semantic Meaning (Design intent)

- `background` / `foreground`: app canvas + default text
- `card` / `card-foreground`: elevated surfaces
- `popover` / `popover-foreground`: floating layers
- `primary`: primary CTA and emphasis
- `secondary`: secondary CTA and neutral action surface
- `muted`: subdued backgrounds/content blocks
- `accent`: hover/highlight treatment
- `destructive`: danger/error actions
- `border`, `input`, `ring`: separators, form field surface, focus ring
- `chart-1..5`: ordered categorical chart palette
- `sidebar-*`: dedicated navigation shell palette

---

## 5) Tailwind Mapping

The app maps CSS variables to Tailwind semantic tokens using `@theme inline` in global styles.

Examples:

- `bg-background`, `text-foreground`
- `bg-card`, `text-card-foreground`
- `bg-primary`, `text-primary-foreground`
- `border-border`, `outline-ring/50`

Do not design against hardcoded component hex values. Design against semantic tokens only.

---

## 6) Preset Definition Shape

Use this preset shape for handoff to engineering:

```ts
export type ThemePreset = {
  source?: "SAVED" | "BUILT_IN";
  createdAt?: string;
  label?: string;
  styles: {
    light: Partial<ThemeStyleProps>;
    dark: Partial<ThemeStyleProps>;
  };
};
```

### Handoff JSON Template

```json
{
  "name": "my-theme-name",
  "label": "My Theme Label",
  "styles": {
    "light": {
      "background": "oklch(...)",
      "foreground": "oklch(...)",
      "primary": "oklch(...)",
      "primary-foreground": "oklch(...)"
    },
    "dark": {
      "background": "oklch(...)",
      "foreground": "oklch(...)",
      "primary": "oklch(...)",
      "primary-foreground": "oklch(...)"
    }
  }
}
```

Note: at runtime, missing keys are merged with default theme values.

---

## 7) Design QA Checklist

Before signoff:

- Contrast: body text and interactive text pass accessibility targets
- Focus visibility: `ring` is visible on both modes
- Surface separation: `card`, `popover`, and `background` are distinguishable
- Action hierarchy: `primary` vs `secondary` is clear
- Destructive clarity: danger state is obvious without overwhelming UI
- Chart legibility: all `chart-*` colors are distinguishable in both modes
- Sidebar consistency: sidebar tokens harmonize with app shell
- Typography fit: chosen font stack supports language and numerals used in app

---

## 8) Naming & Governance

Preset naming rules:

- Use kebab-case key for preset ID (example: `ocean-breeze`)
- Keep labels human-readable (example: `Ocean Breeze`)
- Avoid domain-specific naming tied to temporary business features

Versioning recommendation:

- Treat token changes as design-system changes
- Capture rationale for significant palette or contrast changes in PR notes

---

## 9) Implementation References

- Theme service docs: `apps/web-client/src/services/theme/README.md`
- Existing design token reference: `apps/web-client/src/docs/THEME_DEFINITIONS.md`
- Runtime token application: `apps/web-client/src/services/theme/apply/`
- Theme schema/types: `apps/web-client/src/services/theme/types/index.ts`
