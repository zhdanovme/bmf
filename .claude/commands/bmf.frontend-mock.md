---
description: Generate a clickable frontend mock (Vite + React + shadcn/ui) from BMF YAML specification.
---

## User Input

```text
$ARGUMENTS
```

## Overview

Generate a fully clickable frontend prototype from a BMF YAML project. The mock renders all screens, layouts, dialogs, and navigation as a working React app using **Vite + React + TypeScript + shadcn/ui + Tailwind CSS**.

The mock is NOT a production app — it's a clickable prototype for validating UX flows, reviewing screen layouts, and demonstrating the product to stakeholders.

**What gets rendered:**

- **Screens** → pages with components, data placeholders, and navigation
- **Layouts** → page shells with sidebar/tab navigation
- **Dialogs** → modal windows triggered by buttons
- **Actions** → click handlers that navigate between screens or open dialogs
- **Components** → shadcn/ui elements (inputs, buttons, toggles, lists, cards)
- **Entities** → mock data generated from entity definitions

## Execution

### 1. Parse Arguments

Extract from `$ARGUMENTS`:

- `folder` (required) — path to BMF project folder (e.g., `bmfs/works/rfa`)
- `output` — output directory for the generated app (default: `{folder}/mock/`)

If folder is empty, list available projects in `bmfs/` and ask user to specify.

### 2. Read All Project Data

Read and parse ALL `.yaml` files in `{folder}/`:

**A. `screen.yaml`** — all screens with layout refs, data bindings, components
**B. `layout.yaml`** — all layouts with nav-item components
**C. `component.yaml`** — reusable component anchors
**D. `action.yaml`** — actions with effects (navigation, dialogs, toasts, CRUD)
**E. `dialog.yaml`** — dialogs with props, data, components
**F. `entity.yaml`** — data models with field definitions
**G. `context.yaml`** — global context (current user, computed queries)
**H. `main.yaml`** — project metadata, entry point action
**I. `event.yaml`** — events (for toast/notification mockups)
**J. Any custom `.yaml` files** — additional entity types

Build internal maps:

- `screens{}` — screen ID → { layout, data, components, description, tags }
- `layouts{}` — layout ID → { components (nav-items) }
- `dialogs{}` — dialog ID → { props, data, components }
- `actions{}` — action ID → { props, effects } — parse effects to extract navigation targets ($screen.*), dialog targets ($dialog.*), toast messages ($toast.*)
- `entities{}` — entity ID → { data fields with types/defaults }
- `components{}` — anchor name → component definition
- `entryAction` — the action:main:app-entry or first screen as fallback

### 3. Build Navigation Graph

From actions, extract all navigation relationships:

```
screen:A → action:X → screen:B       (button click navigates)
screen:A → action:Y → dialog:D       (button opens dialog)
dialog:D → action:Z → screen:C       (dialog button navigates)
dialog:D → $dialog.close             (close dialog)
```

Also extract from layouts:
```
layout:main → nav-item → action:nav:go-X → screen:X
```

Determine:

- **Entry screen** — trace `action:main:app-entry` effects to find the first screen
- **Screen → layout mapping** — which layout each screen uses
- **Layout → screens grouping** — group screens by their layout for sidebar navigation

### 4. Generate Mock Data

For each entity, generate 3–5 mock records based on field definitions:

- `uuid` → random UUID
- `string` → realistic placeholder text based on field name (e.g., `name` → "Иван Петров", `email` → "user@example.com")
- `datetime` → recent dates
- `0` / numeric → random numbers in reasonable range
- `true/false` → random boolean
- `$entity:*` reference → UUID of a mock record from the referenced entity
- Enum-like strings (e.g., `draft`, `active`) → use the default value

For context, generate a single current_user mock record.

### 5. Scaffold the Vite + React Project

Create the project structure at `{output}/`:

```
{output}/
├── package.json
├── tsconfig.json
├── tsconfig.app.json
├── vite.config.ts
├── index.html
├── postcss.config.js
├── tailwind.config.ts          # Tailwind v4 / v3 config
├── components.json             # shadcn/ui config
├── src/
│   ├── main.tsx                # React entry point with router
│   ├── App.tsx                 # Router setup with all routes
│   ├── index.css               # Tailwind imports
│   ├── lib/
│   │   └── utils.ts            # shadcn cn() utility
│   ├── data/
│   │   └── mock-data.ts        # All generated mock data
│   ├── store/
│   │   └── navigation.ts       # Simple navigation state (current screen, dialog stack)
│   ├── layouts/
│   │   └── {LayoutName}.tsx    # One component per layout
│   ├── screens/
│   │   └── {ScreenName}.tsx    # One component per screen
│   ├── dialogs/
│   │   └── {DialogName}.tsx    # One component per dialog
│   └── components/
│       └── ui/                 # shadcn/ui components (inline, not via CLI)
│           ├── button.tsx
│           ├── input.tsx
│           ├── card.tsx
│           ├── dialog.tsx
│           ├── toggle.tsx
│           ├── badge.tsx
│           ├── separator.tsx
│           ├── scroll-area.tsx
│           ├── toast.tsx        # or sonner
│           └── ...
```

### 6. Component Type Mapping

Map BMF component types to shadcn/ui + Tailwind:

| BMF type | shadcn/ui component | Notes |
|----------|-------------------|-------|
| `text` | `<p>` or `<h2>` | Use heading if first in a group, paragraph otherwise |
| `value` | `<div>` with label + value | Label in muted text, value below |
| `input` | `<Input>` + `<Label>` | With placeholder from label |
| `button` | `<Button>` | onClick → navigate or open dialog based on value |
| `toggle` | `<Switch>` + `<Label>` | |
| `icon` | Lucide icon | Map "error" → AlertCircle, "warning" → AlertTriangle, "info" → Info |
| `image` | `<img>` with placeholder | Use placeholder service or gray box |
| `list` | `map()` over mock data | Render inner components for each item |
| `nav-item` | Sidebar/tab item | Active state based on current screen |

### 7. Layout Generation

For each layout, generate a React component:

```tsx
// layouts/MainLayout.tsx
export function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <aside className="w-64 border-r bg-muted/40 p-4">
        <nav className="space-y-2">
          {/* nav-items from layout definition */}
          <NavItem label="..." href="/screen/..." active={...} />
          {/* conditional nav-items: render all, ignore `if` conditions in mock */}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto p-6">
        {children}
      </main>
    </div>
  )
}
```

For layouts without nav-items (e.g., `layout:global:auth`), generate a centered full-screen layout:

```tsx
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="w-full max-w-md space-y-6 p-6">
        {children}
      </div>
    </div>
  )
}
```

### 8. Screen Generation

For each screen, generate a React component that:

1. Wraps content in the appropriate layout
2. Renders all components in order
3. Binds mock data to `data.*` references
4. Handles `value: $action.*` on buttons by:
   - If action navigates to a screen → `navigate('/screen/...')`
   - If action opens a dialog → `setDialog('dialog:...')`
   - If action shows a toast → `toast('...')`
5. Renders `list` components by iterating over mock data arrays
6. Handles conditional `if/then/else` by rendering the `then` branch (happy path)

```tsx
// screens/AuthLogin.tsx
export function AuthLoginScreen() {
  const navigate = useNavigate()
  return (
    <AuthLayout>
      <h2 className="text-2xl font-bold">Вход в систему</h2>
      <div className="space-y-4">
        <div>
          <Label>Логин</Label>
          <Input placeholder="Логин" />
        </div>
        <div>
          <Label>Пароль</Label>
          <Input type="password" placeholder="Пароль" />
        </div>
        <Button onClick={() => navigate('/screen/chat/main')}>
          Войти
        </Button>
      </div>
    </AuthLayout>
  )
}
```

### 9. Dialog Generation

For each dialog, generate a component using shadcn `<Dialog>`:

```tsx
// dialogs/CommonError.tsx
export function CommonErrorDialog({ open, onClose, message }: Props) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <AlertCircle className="text-destructive" />
        <DialogTitle>Ошибка</DialogTitle>
        <p>{message || "Произошла ошибка"}</p>
        <Button onClick={onClose}>OK</Button>
      </DialogContent>
    </Dialog>
  )
}
```

Dialog state is managed globally — any button with `value: $dialog.*` opens the corresponding dialog.

### 10. Router Setup

Generate `App.tsx` with React Router:

```tsx
function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Entry redirect */}
        <Route path="/" element={<Navigate to="/screen/{entry-screen}" />} />

        {/* One route per screen */}
        <Route path="/screen/auth/login" element={<AuthLoginScreen />} />
        <Route path="/screen/chat/main" element={<ChatMainScreen />} />
        {/* ... all screens */}
      </Routes>

      {/* Global dialog layer */}
      <DialogManager />

      {/* Toast notifications */}
      <Toaster />
    </BrowserRouter>
  )
}
```

Route paths follow the pattern: `/screen/{epic}/{name}` matching `screen:epic:name`.

### 11. Action Effect Resolution

For each action, determine what happens on click:

**A. Navigation effects** (`$screen.*`):

```
$screen.chat.main → navigate('/screen/chat/main')
$screen.auth.permissions(user_id: ...) → navigate('/screen/auth/permissions')
```

Ignore parameters in the mock — just navigate to the screen.

**B. Dialog effects** (`$dialog.*`):

```
$dialog.common.error(message: "...") → openDialog('common-error', { message: "..." })
$dialog.data.add-source → openDialog('data-add-source')
```

**C. Toast effects** (`$toast.*`):

```
$toast.success(message: "Сохранено") → toast.success("Сохранено")
$toast.error(message: "Ошибка") → toast.error("Ошибка")
```

**D. Close dialog** (`$dialog.close`):

```
$dialog.close → closeDialog()
```

**E. Other effects** (create, delete, context assignment):

Ignore in mock — these are backend operations. Optionally show a toast "Action executed" for feedback.

**F. Conditional effects** (`if/then/else`):

Always execute the `then` branch (happy path) in the mock. If `then` has multiple effects, execute the first navigation or dialog.

### 12. shadcn/ui Components

Include shadcn/ui components inline (copy component source into `src/components/ui/`). Do NOT use the shadcn CLI — generate files directly.

Required components:

- `button.tsx` — buttons
- `input.tsx` — text inputs
- `label.tsx` — form labels
- `card.tsx` — cards for list items and grouped content
- `dialog.tsx` — modal dialogs
- `switch.tsx` — toggles
- `badge.tsx` — tags/status indicators
- `separator.tsx` — visual dividers
- `scroll-area.tsx` — scrollable containers
- `avatar.tsx` — user avatars (for user-related screens)

Use `sonner` for toast notifications (simpler than shadcn toast).

### 13. Styling & Polish

- Use Tailwind utility classes throughout
- Consistent spacing: `space-y-4` for form fields, `gap-4` for grids
- Responsive: sidebar collapses on mobile (or use sheet)
- Active nav-item highlighted based on current route
- Mock data displayed in tables for list screens, cards for detail screens
- Empty states for screens with no mock data
- Project name from `main.yaml` shown in the sidebar header

### 14. Install & Run

Generate `package.json` with:

```json
{
  "name": "{project-name}-mock",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19",
    "react-dom": "^19",
    "react-router-dom": "^7",
    "lucide-react": "latest",
    "sonner": "latest",
    "class-variance-authority": "latest",
    "clsx": "latest",
    "tailwind-merge": "latest"
  },
  "devDependencies": {
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@vitejs/plugin-react": "latest",
    "typescript": "~5.7",
    "vite": "^6",
    "tailwindcss": "^4",
    "@tailwindcss/vite": "^4",
    "autoprefixer": "latest"
  }
}
```

After generating all files:

```bash
cd {output}
npm install
```

### 15. Report Summary

After generation, report:

```
Frontend mock generated: {output}/

Contents:
  Screens: {N} pages
  Layouts: {N} layout templates
  Dialogs: {N} modal dialogs
  Actions: {N} click handlers ({N} navigation, {N} dialogs, {N} toasts)
  Mock data: {N} entities with {N} total records

Entry point: {entry screen}
Routes: {list of all /screen/... paths}

To run:
  cd {output}
  npm install
  npm run dev
```

## Behavior Rules

- Never overwrite an existing mock directory without confirmation
- Generate ALL screens from the spec — don't skip any
- Every screen must be reachable via navigation (no orphan routes)
- Dialogs must be openable from the buttons that reference them
- Mock data should be realistic and use the correct language (ru/en matching the project)
- Use the latest stable versions of all dependencies
- shadcn/ui components are included inline — do NOT require `npx shadcn` CLI
- The mock must work with just `npm install && npm run dev` — no additional setup
- Conditional rendering (`if/then/else`) in screens: render the `then` branch (happy path)
- Action parameters are ignored in navigation — just navigate to the target screen
- For `list` components: iterate over mock data; if no mock data available, show 3 placeholder items
- Keep the generated code clean and readable — it may be used as a starting point for implementation
