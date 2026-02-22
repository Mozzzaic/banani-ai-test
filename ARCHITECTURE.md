# Architecture Deep Dive

> For setup instructions, see [README.md](./README.md).

## Overview

The agent follows a **two-phase architecture**: a fast Router picks the right action, then a parallel Executor generates HTML for each component independently.

```
User Prompt
    |
    v
+-----------------------------+
|  Phase 1 — ROUTER (Flash)   |  Decides WHAT to do
|  tool_use -> pick one of:    |
|    - generate_screen         |
|    - update_components       |
|    - regenerate_screen       |
+-------------+---------------+
              | tool call + parameters
              v
+-----------------------------+
|  Phase 2 — EXECUTOR (Pro)    |  Does the WORK
|  Promise.all() -> parallel   |
|  HTML generation per component|
+-------------+---------------+
              |
              v
+-----------------------------+
|  Assembler                   |
|  Sort by order -> wrap in    |
|  HTML doc + Tailwind CDN     |
+-----------------------------+
```

## 1. Agent Decision-Making

The Router receives the full conversation history and a semantic summary of the current screen:

```
Current screen components:
- [uuid] Header Navigation (navbar): Top nav with logo and links
- [uuid] Hero Section (hero): Large banner with headline
- [uuid] Footer (footer): Contact info and social links
```

Three rules drive the decision:

| Condition | Tool | Rationale |
|---|---|---|
| No screen exists | `generate_screen` | Nothing to update, must create from scratch |
| Styling/text changes to existing items | `update_components` | Surgical edits, preserve everything else |
| Structural changes (add/remove sections) | `regenerate_screen` | Need to re-architect the layout |

This is intentionally simple. The Router's job is a classification task, not a creative one — so we use Flash for speed.

## 2. Tool Design

### `generate_screen`

Creates a screen from nothing. The Router produces:
- `screen_description`: high-level intent
- `style_guide`: shared design tokens (colors, border radius, fonts) passed to every Executor call so parallel components look cohesive
- `components[]`: array of `{ name, type, description }`

The `style_guide` is saved on the Screen object so that follow-up calls can reuse it — this prevents visual drift across turns.

### `update_components`

Surgical updates. The Router outputs:
- `updates[]`: array of `{ component_id, instruction }`

Only targeted components are re-generated. Untouched components pass through as-is. The persisted `style_guide` is injected into the Executor prompt to keep things consistent.

### `regenerate_screen`

Structural changes. The Router outputs:
- `instruction`: what changed globally
- `components[]`: new component list, where each can optionally carry `keep_from_id`

When `keep_from_id` is set, the Executor skips generation and reuses the existing HTML. This saves time and API calls for components that haven't changed.

### Why three tools and not one?

A single "do everything" tool would force the LLM to decide internally what to keep vs. regenerate, mixing routing logic with generation. Separating them:
- Gives us explicit control over the update strategy
- Makes the Router's job a simple classification
- Lets us optimize each path independently (e.g., `update_components` skips untouched components entirely)

## 3. Component Model

```typescript
interface Component {
  id: string;          // UUID, stable across updates
  name: string;        // Human-readable ("Hero Section")
  type: string;        // Semantic category ("hero", "navbar", "card_grid")
  html: string;        // Raw HTML fragment (no <html>, <body>)
  order: number;       // Position in the assembled screen
  description: string; // What it does — fed back to the Router for context
}

interface Screen {
  components: Component[];
  assembledHtml: string;  // Full HTML document ready for iframe
  styleGuide?: string;    // Persisted design tokens from initial generation
}
```

Key choices:
- **`id` is a UUID**, generated once and preserved through updates. This lets the Router reference specific components in `update_components`.
- **`description` is semantic**, not visual. The Router never sees raw HTML — it sees "Top navigation bar with logo and links". This keeps the routing context clean.
- **`order` determines layout position**. The Assembler sorts by `order` before compositing.

## 4. Screen Assembly

The Assembler (`lib/assembler.ts`) is minimal:

1. Sort components by `order`
2. Wrap each in a `<div data-component-id="...">` for highlighting
3. Add HTML comments around each for debugging
4. Inject into a standard HTML document with Tailwind CDN

Components go directly into `<body>` — no wrapper div, no forced flex layout. The generated HTML controls its own layout.

## 5. Component Highlighting

The sidebar and iframe communicate via `postMessage`:

1. Hovering a component in the sidebar sends `{ type: "highlight-component", id }` to the iframe
2. A script inside the iframe applies a blue outline to the matching `data-component-id` wrapper (and its children, to handle `position: fixed/sticky` elements like navbars)
3. The iframe uses an `onLoad` callback to ensure the highlight script is ready before accepting messages

## 6. Conversation Flow

### Message history
The full conversation history is passed to the Router every turn. This is how it resolves references like "the header" or "that section with the pricing".

### Descriptive assistant messages
After each action, the assistant message describes what was done:

- `"Generated a new screen with 5 components: Navbar, Hero, Features, Testimonials, Footer."`
- `"Updated 1 component: Hero Section (change accent color to emerald)."`
- `"Restructured the screen (kept Navbar, Footer; created Playlist Grid). 4 components total."`

This gives the Router context on follow-up turns.

### Style guide persistence
The `style_guide` from `generate_screen` is saved and automatically passed to subsequent calls. This prevents partial updates from drifting away from the original design.

## 7. Streaming (SSE)

The API route uses Server-Sent Events to push real-time status updates:

```
event: status -> "Analyzing your request..."
event: status -> "Breaking down into 5 components..."
event: status -> "Generating Navbar..."
event: status -> "Generating Hero Section..."
event: status -> "Assembling final screen..."
event: done   -> { screen, messages }
```

Implemented via a `ReadableStream` response and an `onStatus` callback passed into `processPrompt()`.

## 8. Session Isolation

Session state is now scoped by browser cookie, not by a single global key.

- Cookie name: `banani_session_id`
- Flags: `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` in production only
- Lifetime: 7 days (`Max-Age`)
- Store: in-memory `Map<sessionId, { state, updatedAt }>`
- TTL cleanup: sessions expire after 24h of inactivity, cleaned on each API request

Why this matters:

- Two users no longer share the same conversation context.
- A browser refresh keeps the same session ID.
- `GET /api/session` hydrates the UI after refresh.
- Reset is scoped to the active browser session only.

## 9. Testing Strategy

The project uses **Vitest** with **Testing Library**.

Covered areas:

- `assembler` unit tests: ordering + component wrapper assertions
- `session` unit tests: isolation, scoped reset, TTL cleanup
- API integration tests:
  - `/api/generate`: payload validation, SSE events, cookie creation/reuse
  - `/api/session`: session hydration contract + cookie behavior
  - `/api/reset`: scoped reset behavior
- UI component test: controlled prompt input submit flow

Route tests mock `processPrompt()` so tests stay deterministic and do not call Gemini.

## 10. Dual-Model Strategy

| Phase | Model | Why |
|---|---|---|
| Router | Gemini 2.5 Flash | Fast (~1-2s). Only classifies intent — doesn't generate HTML. |
| Executor | Gemini 2.5 Pro | Quality HTML/Tailwind output. Visual polish matters here. |

## File Map

```
lib/
  agent.ts      -> Core two-phase agent (Router + Executor)
  assembler.ts  -> Composes components into a full HTML document
  errors.ts     -> Shared unknown-error to message helper
  session-cookie.ts -> Cookie parse/build helpers for session ID
  types.ts      -> Component, Screen, Message, SessionState
  session.ts    -> In-memory per-session store with TTL cleanup

app/
  page.tsx              -> Main layout, SSE stream consumer
  api/generate/route.ts -> SSE streaming endpoint
  api/session/route.ts  -> Reads active session for page hydration
  api/reset/route.ts    -> Session reset (scoped to current cookie)

components/
  ComponentSidebar.tsx  -> Component tree with expandable element inspector + edit buttons
  PromptBox.tsx         -> Controlled chat input + streaming status display
  ScreenRenderer.tsx    -> Sandboxed iframe with postMessage highlighting
  ResetButton.tsx       -> Clears session state

tests/
  api/                  -> Route behavior tests with mocked agent
  lib/                  -> Unit tests for assembler and session store
  components/           -> Prompt input behavior test

.github/workflows/
  ci.yml                -> Lint + test + build pipeline
```
