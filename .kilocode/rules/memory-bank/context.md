# Active Context: Next.js Starter Template

## Current State

**Template Status**: ✅ Ready for development

The template is a clean Next.js 16 starter with TypeScript and Tailwind CSS 4. It's ready for AI-assisted expansion to build any type of application.

## Recently Completed

- [x] Base Next.js 16 setup with App Router
- [x] TypeScript configuration with strict mode
- [x] Tailwind CSS 4 integration
- [x] ESLint configuration
- [x] Memory bank documentation
- [x] Recipe system for common features
- [x] Interactive PDF viewer with pdfjs-dist (popup + multiple-choice interactions)
- [x] Data-driven config system (PDFViewerConfig) for reusable PDF interactions
- [x] Three interactions: optimistic popup, duration popup, minute/minutes choice

## Current Structure

| File/Directory | Purpose | Status |
|----------------|---------|--------|
| `src/app/page.tsx` | Home page (renders PDFPage) | ✅ Ready |
| `src/app/layout.tsx` | Root layout | ✅ Ready |
| `src/app/globals.css` | Global styles | ✅ Ready |
| `src/components/PDFPage.tsx` | Client wrapper with PDF config | ✅ Ready |
| `src/components/InteractivePDFViewer.tsx` | Core PDF viewer component | ✅ Ready |
| `src/lib/pdf-interactions.ts` | TypeScript types for interaction config | ✅ Ready |
| `src/lib/empty.ts` | Empty module alias for `canvas` (pdfjs-dist) | ✅ Ready |
| `public/pdf/` | PDF directory — place `document.pdf` here | ⚠️ Needs PDF |
| `.kilocode/` | AI context & recipes | ✅ Ready |

## Current Focus

Interactive PDF viewer implemented and deployed. The PDF file must be placed at `public/pdf/document.pdf` to be served at `/pdf/document.pdf`.

## Quick Start Guide

### To add a new page:

Create a file at `src/app/[route]/page.tsx`:
```tsx
export default function NewPage() {
  return <div>New page content</div>;
}
```

### To add components:

Create `src/components/` directory and add components:
```tsx
// src/components/ui/Button.tsx
export function Button({ children }: { children: React.ReactNode }) {
  return <button className="px-4 py-2 bg-blue-600 text-white rounded">{children}</button>;
}
```

### To add a database:

Follow `.kilocode/recipes/add-database.md`

### To add API routes:

Create `src/app/api/[route]/route.ts`:
```tsx
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ message: "Hello" });
}
```

## Available Recipes

| Recipe | File | Use Case |
|--------|------|----------|
| Add Database | `.kilocode/recipes/add-database.md` | Data persistence with Drizzle + SQLite |

## Pending Improvements

- [ ] Add more recipes (auth, email, etc.)
- [ ] Add example components
- [ ] Add testing setup recipe

## Session History

| Date | Changes |
|------|---------|
| Initial | Template created with base setup |
| 2026-03-18 | Interactive PDF viewer built with pdfjs-dist; three interactions configured |
