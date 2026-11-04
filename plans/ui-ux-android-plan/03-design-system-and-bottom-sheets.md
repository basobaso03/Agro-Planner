# 03 — Design System, Bottom Sheet Framework & Keyboard Engine

This document specifies:
1. Design tokens eliminating CSS `!important` hacks (Fixes B8)
2. The unified `<BottomSheet>` and `<FormSheet>` primitive (Fixes form layout, animation, and height issues)
3. Virtual keyboard handling engine for Android WebViews (Fixes B7, B18)
4. Inline and sticky validation architecture (Fixes B5, B6)
5. Resolution of the ugly "0 Active" badge on small phones (Fixes B21)

---

## 1. Design Tokens & Color System (Fixes B8)

CapitaSeed uses a warm, trustworthy financial palette called **"Solora Warm Financial"** (warm paper surfaces, emerald wealth, amber caution, slate text).

### 1.1 Root CSS Variables (`src/design/tokens.css`)
```css
:root {
  /* Surfaces */
  --color-surface-canvas: #FAF8F5;   /* Warm off-white background */
  --color-surface-card:   #FFFFFF;   /* Pure white card container */
  --color-surface-subtle: #F3EFEA;   /* Inset container / table row */
  --color-surface-overlay: rgba(15, 23, 42, 0.65); /* Sheet scrim */

  /* Borders & Dividers */
  --color-border-subtle:  #F0EBE1;
  --color-border-default: #E8DFCE;   /* Standard warm card border */
  --color-border-focus:   #059669;   /* Emerald brand outline */

  /* Text & Ink */
  --color-ink-primary:    #0F172A;   /* Slate-900 (crisp headline & amount) */
  --color-ink-secondary:  #475569;   /* Slate-600 (subtitles & labels) */
  --color-ink-muted:      #94A3B8;   /* Slate-400 (captions & placeholder) */
  --color-ink-inverse:    #FFFFFF;   /* High-contrast on colored pills */

  /* Semantic Brand & Banking */
  --color-brand-emerald:  #059669;   /* Cash on ground, positive balance */
  --color-brand-emerald-subtle: #ECFDF5;
  --color-accent-amber:   #D97706;   /* Credit sales, receivables, caution */
  --color-accent-amber-subtle: #FFFBEB;
  --color-danger-rose:    #E11D48;   /* Borrowed debt, overdue, errors */
  --color-danger-rose-subtle: #FFF1F2;
  --color-info-blue:      #2563EB;   /* Runway planning, audit hash */

  /* Radii & Geometry */
  --radius-sheet-top:     28px;      /* Rounded top corners on bottom sheet */
  --radius-card:          20px;      /* Elevated cards */
  --radius-control:       12px;      /* Input fields & buttons */
  --radius-chip:          9999px;    /* Pill badges */

  /* Touch & Insets */
  --touch-target-min:     48px;      /* Android standard minimum touch target */
  --sat: env(safe-area-inset-top, 0px);
  --sab: env(safe-area-inset-bottom, 0px);
  --kb: 0px;                         /* Injected by Keyboard listener */
}
```

### 1.2 Elimination of `!important` CSS Hacks
- Delete lines 168–170 from `src/index.css`:
  - Remove `.text-white { color: #0F172A !important }`
  - Remove `.bg-slate-950`, `.bg-slate-900` global overrides
- Replace with semantic utility classes:
  - `.bg-surface` (`background-color: var(--color-surface-card)`)
  - `.text-ink` (`color: var(--color-ink-primary)`)
  - `.border-token` (`border-color: var(--color-border-default)`)

---

## 2. `<BottomSheet>` — The Single Modal Shell

Every modal and in-page form across the application is migrated onto `<BottomSheet>`. It renders into a React portal (`#sheet-root`) positioned at the bottom of the viewport.

### 2.1 Visual Anatomy & Layout Rules
```
┌────────────────────────────────────────────────────────┐ (Status Bar safeTop)
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │ (Max 88dvh — NEVER hits status bar)
│  │                     [ ═══ ]                      │  │ Grab handle (4×36dp)
│  │ ┌──────────────────────────────────────────────┐ │  │
│  │ │ Title: Record Credit Sale         [ ✕ Close] │ │  │ Sticky Sheet Header
│  │ │ Subtitle: Customer details & payment terms   │ │  │
│  │ └──────────────────────────────────────────────┘ │  │
│  │                                                  │  │
│  │ ┌──────────────────────────────────────────────┐ │  │
│  │ │ ⚠ Sticky Error Banner (if validation fails)   │ │  │ Sticky top of body
│  │ ├──────────────────────────────────────────────┤ │  │
│  │ │ Form Fields (Scrollable Body)                │ │  │
│  │ │ - Customer Name, Phone, Address              │ │  │ Auto-scrolls to focused input
│  │ │ - Qty, Unit Price, Deposit                   │ │  │
│  │ │ - Live Balance Breakdown Strip               │ │  │
│  │ └──────────────────────────────────────────────┘ │  │
│  │ ┌──────────────────────────────────────────────┐ │  │
│  │ │ [ Cancel ]         [ Save Sale ($450.00) ]   │ │  │ Sticky Sheet Footer
│  │ └──────────────────────────────────────────────┘ │  │ (Pinned directly above keyboard)
│  └──────────────────────────────────────────────────┘  │
│  ════════════════════════════════════════════════════  │
│  [  Android Virtual Soft Keyboard / Navigation Bar  ]  │ Height = var(--kb)
└────────────────────────────────────────────────────────┘
```

### 2.2 Height & Size Constraints ("Do Not Go Too Much on Top")
- **Maximum Height Constraint**:
  $$\text{maxHeight} = \min(88\text{dvh}, \text{visualViewportHeight} - \text{safeTop} - 16\text{px})$$
  The sheet **never** covers the full screen or touches the top status bar. A 12% peek margin of the underlying screen is always visible, giving immediate spatial context to the user that they are in a transient action.
- **Auto-Fitting (`size="auto"`)**:
  - Small forms (e.g. *Record Installment Payment*, *Extend Due Date*, *Spend Gate Picker*) only take up as much height as their content requires (~55–65% of screen height).
  - The sheet never artificially stretches to full height if only 3 fields exist.
- **Tablet / Landscape Viewport (≥ 600dp)**:
  - Renders as a bottom-anchored card with `max-width: 520px`, centered horizontally, still sliding smoothly up from the bottom.

### 2.3 Gesture Drag & Dismiss
- **Header Grab Handle**: Touch-draggable.
- If pulled downward by > 25% of sheet height or flicked with downward velocity > 0.6 px/ms, sheet dismisses.
- If pulled downward slightly and released, it springs back to resting height.
- `touch-action: none` is applied only to the grab handle and header bar, allowing the body area to scroll freely without gesture collision.

---

## 3. Animation Engine (Fixes B9)

Tailwind v4 lacks built-in `animate-in` keyframes. We provide hardware-accelerated animations using `motion` (already in `package.json`) and pure CSS fallback keyframes in `src/design/animations.css`.

### 3.1 Timing & Curves
- **Enter Animation**: Slide up from `translateY(100%)` to `translateY(0)` with opacity fade-in on backdrop scrim.
  - Duration: `280ms`
  - Easing: Emphasized deceleration curve `cubic-bezier(0.05, 0.7, 0.1, 1.0)`
- **Exit Animation**: Slide down from `translateY(0)` to `translateY(100%)` with opacity fade-out.
  - Duration: `200ms`
  - Easing: Emphasized acceleration curve `cubic-bezier(0.3, 0.0, 0.8, 0.15)`
- **Micro-Interactions**:
  - Tapping primary button: Button morphs to spinner, and on completion shows a green checkmark with haptic pulse (`Haptics.notification(Success)`).
  - Validation error shake: Quick 3-cycle horizontal shake (±6px over 180ms) on invalid fields.
  - Reduced Motion: Respects `@media (prefers-reduced-motion: reduce)` by substituting instant cross-fades (100ms) for slide animations.

---

## 4. Virtual Keyboard Adaptation Engine (Fixes B7, B18)

Android WebViews suffer from unpredictable keyboard resizing. Our unified strategy guarantees inputs and submit buttons are never obscured.

### 4.1 Capacitor Keyboard Configuration
In `capacitor.config.json`:
```json
{
  "plugins": {
    "Keyboard": {
      "resize": "none",
      "style": "light",
      "resizeOnFullScreen": false
    }
  }
}
```
*Why `resize: "none"`?* Letting Android or the WebView spontaneously resize the HTML body breaks scroll offsets and causes inputs to disappear under dialogs. By setting `resize: "none"`, the app coordinates the layout using CSS custom properties and real hardware insets.

### 4.2 `useKeyboardInset` Hook (`src/hooks/useKeyboardInset.ts`)
1. On native Android: Subscribes to `Keyboard.addListener('keyboardWillShow')` and `'keyboardWillHide'`.
2. On Mobile Browser / PWA: Listens to `window.visualViewport.addEventListener('resize')`.
3. Injects dynamic CSS variables into `:root`:
   - `--kb`: Current height of virtual keyboard in pixels (e.g. `284px` when active, `0px` when closed).
   - `--vvh`: Current visual viewport height.
4. Sheet Container CSS:
   ```css
   .bottom-sheet-container {
     position: fixed;
     bottom: var(--kb);
     max-height: calc(var(--vvh) - var(--sat) - 16px);
     transition: bottom 220ms cubic-bezier(0.05, 0.7, 0.1, 1.0);
   }
   ```
5. **Sticky Footer Above Keyboard**: The footer containing the primary "Save" button is styled with `position: sticky; bottom: 0; z-index: 10; background: #FFF`. When the keyboard appears, the entire sheet container lifts by `var(--kb)`, keeping the Save button continuously visible directly above the keyboard keys.

### 4.3 Intelligent Input Scroll
- When any input receives focus, `scrollIntoView({ behavior: 'smooth', block: 'nearest' })` is called on the active field inside the **sheet body scroll container only** after a 50ms delay.
- The global aggressive centering listener in `App.tsx:182-198` (`scrollIntoView({ block: 'center' })`) is **removed**.

### 4.4 Mobile-Optimized Input Attributes
- Currency / Amounts: `<input inputMode="decimal" type="text" pattern="[0-9]*[.,]?[0-9]*" />` (launches numeric keypad with decimal dot).
- Phone Numbers: `<input inputMode="tel" type="tel" />` (launches telephone dialing keypad).
- Notes / Reason: `<textarea enterKeyHint="done" rows={3} />`.
- Font Size: All `<input>` and `<textarea>` elements have minimum `font-size: 16px` to prevent iOS/Android WebView auto-zooming.

---

## 5. Inline & Sticky Validation Architecture (Fixes B5, B6, B23)

### 5.1 Why the Old Pattern Failed
In `CreditSalesModal.tsx` and `ExpensesFeedTab.tsx`:
```tsx
{formError && <div className="p-3 bg-rose-50 text-rose-700">{formError}</div>}
```
This was placed at the top of the modal body. When an operator scrolled down past 5 inputs to tap the Save button at the bottom, an error occurred, but the banner was rendered off-screen at the top. The operator saw no button state change, no error text, and concluded the button was broken.

### 5.2 The 3-Tier Feedback Engine
1. **Sticky Top Error Banner**:
   If validation fails or `dataService` throws, an alert banner appears at the very top of the sheet body with `position: sticky; top: 0; z-index: 20; box-shadow: 0 4px 12px rgba(0,0,0,0.08)`. Even if the user is scrolled to the very bottom, the sticky banner drops into view immediately.
2. **Inline Field Errors**:
   Every field component (`<Field>`) renders a red border and red helper text (`<p role="alert">`) directly beneath the offending input.
3. **Auto-Scroll & Focus**:
   On failed submit:
   - Body smoothly scrolls to the first invalid field.
   - The field is focused.
   - Haptic error pattern is triggered (`Haptics.notification(Error)`).

### 5.3 Removal of Native `required` HTML Bubbles (Fixes B6)
- Forms use `<form noValidate onSubmit={form.handleSubmit}>`.
- Validation is executed via pure TypeScript schemas (`src/utils/validation.ts`). No native browser bubbles that hide behind keyboards.

---

## 6. Resolution of the "0 Active" Ugly Badge (Fixes B21)

### 6.1 The Problem in Existing Code
In `CreditSalesModal.tsx:218-220`:
```tsx
<h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
  Sales on Credit &amp; Receivables
  <span className="text-[11px] font-mono font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-300">
    {activeSalesCount} Active
  </span>
</h2>
```
On small mobile screens (e.g. 320px–360px width), this forces the title onto 3 lines and places a loud amber badge shouting "0 Active" even when zero debt/credit is a positive state. Similarly, `LoansDebtsModal:429` renders `Borrowed Liabilities (0)` inside a cramped button.

### 6.2 The Redesigned Solution
1. **Remove Count from Title Header**: The AppBar / Sheet header strictly displays clean title text: `Sales on Credit`. No nested count pill in the header.
2. **Move Count into Filter Segment Chips**:
   ```
   [ All (12) ]  [ Outstanding (3) ]  [ Overdue (1) ]  [ Settled (8) ]
   ```
3. **Neutral Styling when Zero**:
   - If a filter segment count is `0`, the chip uses neutral muted styling:
     `bg-slate-100 text-slate-500 border-slate-200`
   - It **never** uses loud amber (`bg-amber-100 text-amber-800 border-amber-300`) unless the count is greater than zero and requires attention.
   - Overdue chip uses `bg-rose-100 text-rose-800 border-rose-300` only if `overdueCount > 0`. If `0`, it is hidden or dimmed.
4. **Summary Card Redesign**:
   - On screens < 360px, summary cards render in a horizontal scrolling row or compact 2-column grid showing `Outstanding: $0.00` and `Collected: $X.XX` with clean font weights without clipped badges.

---

## 7. Reusable Primitives to Build (`src/components/ui/`)

| Component | Responsibility |
|---|---|
| `BottomSheet.tsx` | Base modal shell with drag handle, backdrop, auto-height, and keyboard listening. |
| `FormSheet.tsx` | `<form>` wrapper integrating `useForm`, sticky error banner, saving state, and draft recovery. |
| `ConfirmSheet.tsx` | Replaces `window.confirm` for destructive actions (e.g. *Discard draft?*, *Delete member?*). |
| `PickerSheet.tsx` | Replaces native `<select>` with a searchable bottom sheet for selecting batches, sites, and customers. |
| `DatePickerSheet.tsx` | Quick chips (`+7 days`, `+14 days`, `+30 days`, `End of Month`) plus calendar picker. |
| `Toast.tsx` / `ToastProvider.tsx` | Bottom snackbar system for action confirmations with Undo. |
| `ListRow.tsx` | Banking-style row: Leading icon tile + Title/Subtitle + Trailing Preview Amount + Chevron. |
| `Field.tsx` | Standard input wrapper: label, required star, helper text, and inline error. |
| `MoneyInput.tsx` | Currency-formatted input with decimal keypad and localized symbol prefix. |
| `SyncChip.tsx` | Real-time connectivity and outbox sync pill for the AppBar. |
