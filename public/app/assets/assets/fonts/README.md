# Bundled fonts (Jost)

This folder can contain Jost font files so the app **always** uses Jost on Android and iOS (no device font fallback, including offline and first launch).

- **Included:** `Jost-VariableFont_wght.ttf` (variable weight font from Google Fonts) is bundled; the `google_fonts` package may use it when available in assets.
- **Optional:** For full compatibility with all weights/styles, download [Jost from Google Fonts](https://fonts.google.com/specimen/Jost) (Download family), unzip, and add the `.ttf` files here **without renaming** (e.g. `Jost-Regular.ttf`, `Jost-Italic.ttf`, …).

Bundled files are used instead of runtime HTTP fetch, so the app font stays Jost even when offline.
