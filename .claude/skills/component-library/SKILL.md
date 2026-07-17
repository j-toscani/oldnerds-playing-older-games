---
name: component-library
description: Design rules and usage guidelines for the ONOG component library. Trigger when creating, modifying, or discussing UI components, buttons, forms, or design patterns.
---

# ONOG Component Library Guidelines

## Design Tokens

All colors, spacing, and typography are defined in `apps/website/src/styles/globals.css` via Tailwind `@theme`.

### Color Palette

| Token | Value | Usage |
|---|---|---|
| `bg-base` | `#0b1a2e` | Page background |
| `bg-card` | `#0a1628` | Card backgrounds |
| `bg-elevated` | `#1c2433` | Elevated surfaces, secondary buttons |
| `bg-hover` | `#263040` | Hover states |
| `border-base` | `rgba(255,255,255,0.12)` | Default borders |
| `border-hover` | `rgba(255,255,255,0.25)` | Hover borders |
| `text-primary` | `#ffffff` | Main text |
| `text-secondary` | `#cce6ff` | Supporting text |
| `text-muted` | `#a0a0a0` | De-emphasized text |
| `accent-gold` | `#ab6b12` | Primary CTA (gold) |
| `accent-gold-light` | `#d4a033` | Gold hover |
| `accent-blue` | `#0e86ca` | Secondary accent |
| `accent-blue-lighter` | `#66b3ff` | Blue text/highlights |
| `accent-red` | `#ef4444` | Destructive actions |

### Shared Styling Constants

- **Border radius:** `rounded-[10px]` for cards/buttons, `rounded-md` for small elements
- **Transitions:** `transition-all duration-200`
- **Font:** Inter, Roboto, system sans-serif

---

## Components

### Button

**File:** `apps/website/src/components/Button.tsx`

Reusable button with `variant` and `size` props. Use for all standalone action buttons.

#### Variants

| Variant | Appearance | When to use |
|---|---|---|
| `primary` | Blue bg, white text, lift on hover | Main CTA per view. **Max one primary per visible area.** Examples: "Speichern", "Bestätigen" |
| `secondary` | Elevated bg, border | Alternative actions alongside primary. Examples: "Hinzufügen", "Neu mischen" |
| `ghost` | Transparent, no border, muted text | Low-priority actions. Examples: "Logout", "Abbrechen", "← Zurück" |
| `outlined` | Transparent, visible border | Medium-emphasis actions. Examples: "Bearbeiten", toggles |

#### Sizes

| Size | Classes | When to use |
|---|---|---|
| `sm` | `py-1.5 px-3 text-xs rounded-md` | Inline/compact: "Veto", "Undo", "Logout" |
| `md` | `py-2.5 px-4 text-sm` | Default standalone buttons |
| `lg` | `py-3 px-5 text-[0.95rem]` | Page actions, form submissions: "Hinzufügen", "Weiter" |

#### Decision Rules

1. **One primary per view.** Main action = `primary`, rest = `secondary`/`ghost`/`outlined`.
2. **Destructive actions** use `ghost` + custom red color via `className`.
3. **Navigation-like** ("← Zurück") use `ghost`.
4. **Navbar/toolbar actions** (logout, reset) use `ghost` + `sm`.
5. **Form submissions** that are the page's main purpose use `primary` + `lg`.
6. **Default** when unsure: `secondary` + `md`.

---

### ButtonLink

**File:** `apps/website/src/components/buttons.tsx`

Like Button, but wraps a TanStack `<Link>` for client-side navigation. Use when the action navigates to a route.

#### Variants

| Variant | When to use |
|---|---|
| `primary` | Gold CTA navigation (rare) |
| `ghost` | "← Zurück" links in ActionBar |
| `outline` | Medium-emphasis navigation |

> **Note:** ButtonLink currently only supports `lg` size. Consider aligning sizes with Button component when needed.

---

### ActionBar

**File:** `apps/website/src/components/buttons.tsx`

Flex container for page-level action buttons. Always placed at the bottom of a page section.

```tsx
<ActionBar>
  <Button variant="secondary" size="lg">Neu mischen</Button>
  <ButtonLink variant="ghost" to="/pairing">← Zurück</ButtonLink>
</ActionBar>
```

---

### LoginButton

**File:** `apps/website/src/components/LoginButton.tsx`

Custom Discord-branded OAuth button. Does **NOT** use the Button component – follows Discord brand guidelines (`#5865F2` background, Discord logo SVG).

---

### Special Patterns (not yet componentized)

These patterns appear in the app but don't have dedicated components yet.

#### Listitem Button
Full-width transparent button inside a list row. Used for clickable list items.
- **Where:** Matchup toggle (`pairing.tsx`), Map select (`map-order.tsx`)
- **Style:** `bg-transparent border-none cursor-pointer text-left`
- **Decision:** Keep as inline `<button>` – these are structural, not reusable action buttons.

#### Icon Button (Tiny)
Minimal button for inline icon actions like remove/delete.
- **Where:** "✕" player remove (`index.tsx`), "✕" map remove (`map-order.tsx`)
- **Style:** No padding, no border, muted text, red on hover
- **Decision:** Consider an `IconButton` component if pattern recurs. Currently OK as inline.

#### Toggle Button (Player Select)
Small colored toggle to select P1/P2 winner.
- **Where:** `matchup.tsx` P1/P2 buttons
- **Style:** Conditional blue/gold bg based on active state
- **Decision:** Very context-specific. Keep as inline styling for now.

#### Inline Link
Text link for navigation within content, not in an ActionBar.
- **Where:** "← Zurück zu Pairings" (`veto.tsx`, `map-order.tsx`), "Veto →" (`pairing.tsx`)
- **Style:** `text-accent-blue-lighter hover:text-accent-gold-lighter no-underline`
- **Decision:** Consider a `TextLink` component if pattern recurs.

---

## Complete Element Inventory

### Buttons

| Location | Label | Current | Target Component |
|---|---|---|---|
| `__root.tsx` | "Reset" | inline `<button>` ghost | `<Button variant="ghost" size="sm">` |
| `index.tsx` | "Hinzufügen" | inline `<button>` secondary | `<Button variant="secondary" size="lg">` |
| `index.tsx` | "✕" (player remove) | inline icon button | Keep inline or `IconButton` |
| `index.tsx` | "Matchups erstellen" | inline `<button>` gold primary | `<Button variant="primary" size="lg">` ¹ |
| `pairing.tsx` | matchup toggle | listitem button | Keep inline |
| `pairing.tsx` | "🔀 Neu mischen" | inline `<button>` secondary | `<Button variant="secondary" size="lg">` |
| `veto.tsx` | "Veto" / "↩ Undo" | inline `<button>` ghost+red | `<Button variant="ghost" size="sm">` + red className |
| `map-order.tsx` | "✕" (map remove) | inline icon button | Keep inline or `IconButton` |
| `map-order.tsx` | map select | listitem button | Keep inline |
| `matchup.tsx` | P1/P2 winner | toggle buttons | Keep inline |
| `UserMenu.tsx` | "Logout" | ✅ `<Button variant="ghost" size="sm">` | Done |
| `LoginButton.tsx` | "Login mit Discord" | Custom Discord button | Keep custom |

¹ "Matchups erstellen" uses gold (`accent-gold`) with a box shadow. The Button `primary` variant currently uses blue. **Open decision:** Should `primary` be gold or blue? Or do we need a `cta` variant?

### Links (navigation)

| Location | Label | Current | Target Component |
|---|---|---|---|
| `pairing.tsx` | "Veto →" | inline `<Link>` | Inline Link or `TextLink` |
| `pairing.tsx` | "← Zurück" | inline `<Link>` ghost | `<ButtonLink variant="ghost">` |
| `veto.tsx` | "← Zurück zu Pairings" | inline `<Link>` | `<ButtonLink variant="ghost">` or `TextLink` |
| `map-order.tsx` | "← Zurück zu Pairings" | inline `<Link>` | `<ButtonLink variant="ghost">` or `TextLink` |
| `matchup.tsx` | "← Zurück zu Pairings" | ✅ `<ButtonLink variant="ghost">` | Done |

---

## Resolved Decisions

| Question | Decision | Date |
|---|---|---|
| Primary color | **Gold** (`accent-gold`) with box shadow | 2026-06-19 |
| `danger` variant | **Yes**, own variant (red text, red hover bg) | 2026-06-19 |
| `IconButton` component | **Yes**, square, uses Button CVA variants as base | 2026-06-19 |
| `TextLink` component | **No**, inline `<Link>` is sufficient | 2026-06-19 |
| `ButtonLink` sizes | **Yes**, same sizes via shared CVA variants | 2026-06-19 |
| `loading` state | **No**, will likely be handled via Suspense in TanStack Start | 2026-06-19 |
| Polymorphism (`as` prop) | **No**, separate components (`Button` + `ButtonLink`), shared CVA styles | 2026-06-19 |

## Open Decisions

- [ ] How to best integrate Suspense for loading states in TanStack Start?

---

## Architecture

All button-like components share styles via **CVA** (class-variance-authority):

```
button-variants.ts  ← shared CVA variants (variant + size)
    ├── Button.tsx      ← <button> element
    ├── ButtonLink.tsx   ← <Link> element (TanStack Router)
    └── IconButton.tsx   ← square <button>, icon-only
```

---

## Existing Component Files

| Component | File | Status |
|---|---|---|
| `buttonVariants` | `components/button-variants.ts` | ✅ Shared CVA variants |
| `Button` | `components/Button.tsx` | ✅ Uses CVA |
| `IconButton` | `components/IconButton.tsx` | ✅ Uses CVA |
| `ButtonLink` | `components/buttons.tsx` | ✅ Uses CVA |
| `ActionBar` | `components/buttons.tsx` | Existing |
| `LoginButton` | `components/LoginButton.tsx` | Custom Discord branded |
| `UserMenu` | `components/UserMenu.tsx` | ✅ Uses Button |
| `PageTitle` | `components/PageTitle.tsx` | Existing |
| `PageContainer` | `components/PageContainer.tsx` | Existing |
| `PlayerBadge` | `components/PlayerBadge.tsx` | Existing |
| `TurnIndicator` | `components/TurnIndicator.tsx` | Existing |
| `MapListItem` | `components/MapListItem.tsx` | Existing |
| `MapList` | `components/MapList.tsx` | Existing |
| `SectionLabel` | `components/SectionLabel.tsx` | Existing |
