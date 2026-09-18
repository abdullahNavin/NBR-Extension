# AGENTS.md

Chrome MV3 extension ("NBR Auto Sum") that auto-calculates sum fields on the NBR e-Tax portal (`https://office.etaxnbr.gov.bd/*`). The only shipped code is `content.js`; there is **no build step, no bundler, no package.json, and no automated tests**.

## Commands / verification

- The project is exactly three files: `content.js` (script), `manifest.json`, `sample.html` (dev fixture).
- No `npm`/lint/typecheck/test command exists. Verify by loading `manifest.json` via `chrome://extensions` → "Load unpacked" and manually editing fields on the portal.
- `sample.html` is a static snapshot of the portal's Assets page for testing selectors locally. It is **not** part of the extension; edits there are safe but never shipped. Field names in it live in `formcontrolname` attributes (see `assetsDetail` group).

## Critical mechanics (do not "fix" these)

- The portal is an Angular reactive-forms SPA. Writing a value directly (`input.value = x`) is ignored by Angular. Values must be set via the **native HTMLInputElement value setter** and followed by dispatched `input` + `change` events (`setAngularValue`, `content.js:70`). Preserve this for any new autofill code.
- Inputs are located by CSS `[formcontrolname="<name>"]`, not by `name`/`id` (`queryInput`, `content.js:56`).
- Fields appear/disappear as the SPA navigates, so blur handlers are re-attached via a `MutationObserver` on `document.body` (`content.js:134`).
- The `rules` array (`content.js:12`) is the single source of truth for sums: each rule sums `sources` into `target`. Rules cascade: when a field is itself another rule's source, dependents are recomputed (`cascadeDependents`, `content.js:99`). If you edit the field-name constants, update both `content.js` and the matching fixtures in `sample.html`.
- `parseAmount` (`content.js:62`) strips whitespace, commas, and the Bengali currency symbols `৳`/`৲`, so values may contain these. `formatValue` (`content.js:76`) keeps decimals only when the result is non-integer.
- This is AbortController/`WeakSet`/`Set`-guarded against duplicate bindings and infinite recursion (`bound`, `cascading`). Keep guards intact when adding rules.

## Other gotchas

- `manifest.json` is MV3, needs `tabs` + `scripting` permissions and the `office.etaxnbr.gov.bd` host permission; content script runs at `document_idle`. Bump `version` on behavior changes (last bumped for 2.0.0).
- The portal text is Bangla (Solaiman Lipi); do not mismatch decimal/currency handling for locality.