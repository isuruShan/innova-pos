# Developer Instructions & Guidelines

## Build and Run Commands

- **Build POS client:** `pnpm --filter @pos/client build`
- **Run POS client (dev):** `pnpm --filter @pos/client dev`
- **Run all stack services (dev):** `pnpm run dev`

---

## Coding and Styling Standards

### 1. Theme Contrast & Text Visibility
Whenever making UI/UX modifications to any view in the POS (such as the Order Board or checkout screens), **both light and dark theme modes must maintain high readability and proper color contrast.**
- **Color Inversion in Tailwind v4:** In this project, standard Tailwind colors (e.g. `slate`) are dynamically inverted in light mode in `index.css`:
  - Light slates like `slate-800` and `slate-900` represent **light background colors** in light mode.
  - Dark slates like `slate-100`, `slate-200`, and `slate-300` represent **dark text colors** in light mode.
- Avoid using bright/light text classes like `text-blue-400`, `text-orange-400`, or `text-amber-400` directly on light backgrounds. Instead:
  - **Light mode:** Use darker high-contrast equivalents like `text-blue-700`, `text-orange-700`, `text-amber-800`.
  - **Dark mode:** Use high-visibility light variants like `text-blue-400`, `text-orange-400`, `text-amber-300`.
- Do not use non-standard Tailwind colors (e.g. `text-red-750`, `text-amber-850`) as they will fail to compile or render fallback/invisible styles. Use standard increments (e.g. `text-red-700`, `text-amber-900`).

### 2. PWA Stability & Redirections
- Never trigger window reloads (`window.location.reload()`) automatically inside Service Worker controllers or route lifecycle hooks without guarding against infinite loops.
- All redirects to the login screen (`window.location.href = '/login'`) must check if the browser is already on the login page via `!window.location.pathname.includes('/login')` to prevent refresh loops.

### 3. Offline Product Catalog Pre-Caching
- **Catalogue Loading:** Once the POS is loaded and the cashier has selected a store location, all menu and product data must be preloaded upfront to enable immediate offline order processing and transactions.
- **Caching Mechanism:** Preloaded items must cover `/menu` (categories and products), `/menu/modifier-groups` (modifiers and customizable variations), `/tables` (layout and seating tables), `/promotions` (discounts and offers), and `/stores`.
- **Automatic Sync & Updates:** The preloader (`preloadOfflineData()`) must be triggered inside the `StoreProvider` when store selection is ready/changed, when the browser transitions to online, and during the initial online app load phase.
