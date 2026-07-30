# @voya/design-tokens

Semantic design token foundation for the Voya dual-mode vacation booking platform.

## Status

**PROVISIONAL** — All token values (colours, typography, spacing, radii, elevation) are scaffold
values. They have **not** received Marriott brand approval. Re-skinning the product requires only
changing primitive ramp values in `src/primitives/`; no component rewrites are needed.

## What this package provides

| Export | Purpose |
|---|---|
| `SemanticTokenKey` | TypeScript union type of all valid token names |
| `SemanticTokenMap` | `Record<SemanticTokenKey, string>` — one resolved value per token |
| `lightTheme` | Default theme (light mode) |
| `darkTheme` | Structural dark-mode theme (provisional) |
| `tokenToCssVar(key)` | `"color.text.primary"` → `"--voya-color-text-primary"` |
| `cssVar(key)` | `"color.text.primary"` → `"var(--voya-color-text-primary)"` |
| `buildCssVars(tokens, selector?)` | Generates a CSS custom property block |
| `buildThemeCss(light, dark)` | Generates combined `:root` + `[data-theme="dark"]` CSS |
| `contrastRatio(fg, bg)` | WCAG 2.1 contrast ratio between two hex colours |
| `meetsWcagAA(fg, bg, level?)` | `true` when the pair meets the specified AA threshold |
| `auditContrast(fg, bg)` | Full audit result with ratio and all pass flags |
| `buildManifest(theme, tokens, ts)` | Machine-readable `TokenManifest` for tooling |
| `CRITICAL_TEXT_PAIRINGS` | Reference list of semantic pairs that must pass AA normal |
| `UI_COMPONENT_PAIRINGS` | Reference list of semantic pairs that must pass AA UI (3:1) |

## Usage

### Apply tokens via CSS custom properties

Inject the CSS into your app once at startup:

```ts
import { buildThemeCss, lightTheme, darkTheme } from '@voya/design-tokens';

const css = buildThemeCss(lightTheme, darkTheme);
const style = document.createElement('style');
style.textContent = css;
document.head.appendChild(style);
```

Toggle dark mode by setting `data-theme="dark"` on `<html>`:

```ts
document.documentElement.dataset['theme'] = 'dark';
```

### Reference tokens in component styles (no primitives allowed)

```ts
import { cssVar } from '@voya/design-tokens';

const styles = {
  backgroundColor: cssVar('color.surface.card'),   // "var(--voya-color-surface-card)"
  borderRadius:    cssVar('radius.card'),
  padding:         cssVar('space.6'),
};
```

**Never** import from `src/primitives/` or hardcode hex values in component source.
Re-skinning must be a token-value change, not a component rewrite.

### Validate contrast at build time

```ts
import { meetsWcagAA, CRITICAL_TEXT_PAIRINGS, lightTheme } from '@voya/design-tokens';

for (const pairing of CRITICAL_TEXT_PAIRINGS) {
  const fg = lightTheme[pairing.foreground];
  const bg = lightTheme[pairing.background];
  if (!meetsWcagAA(fg, bg)) {
    throw new Error(`Contrast failure: ${pairing.label}`);
  }
}
```

### Generate a token manifest for tooling

```ts
import { buildManifest, lightTheme } from '@voya/design-tokens';

const manifest = buildManifest('light', lightTheme, new Date().toISOString());
console.log(manifest.count);   // number of tokens
console.log(manifest.tokens);  // [{key, cssVar, value}]
```

## WCAG 2.1 AA thresholds

| Level | Ratio | Usage |
|---|---|---|
| `AA_NORMAL` | 4.5:1 | Normal text (< 18 pt / 14 pt bold) |
| `AA_LARGE`  | 3.0:1 | Large text (≥ 18 pt / ≥ 14 pt bold) |
| `AA_UI`     | 3.0:1 | UI components and graphical objects |

## Naming convention

Token keys use dot-notation: `{category}.{subcategory}.{name}`

CSS custom properties are derived by replacing `.` with `-` and prepending `--voya-`:

```
color.text.primary  →  --voya-color-text-primary
space.4             →  --voya-space-4
radius.card         →  --voya-radius-card
```

## Running tests

```sh
npm test --workspace packages/design-tokens
```

## Provisional notice

Do not treat any token value in this package as final Marriott brand approval.
Dark-mode token values are structural scaffolding only and require brand review
before production use.
