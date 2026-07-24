# `@docengine/pdf-renderer`

PDF (pdfmake) and HTML export for DocEngine documents.

TypeScript sources live in `src/` and compile to `dist/`. Entry points:

- `@docengine/pdf-renderer` — Node / server
- `@docengine/pdf-renderer/browser` — browser bundle helpers

`fonts-browser-vfs.js` is a generated base64 font VFS (see `npm run build:vfs`) and remains JavaScript under `allowJs`, along with SF stubs (`*.sf-stub.js`).
