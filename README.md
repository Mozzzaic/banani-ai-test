# Banani AI — UI Generator

A UI generator that turns natural language prompts into fully rendered web pages. Built for the Banani AI technical test.

## How it works

The app uses a **two-phase agent architecture**:

1. **Router (Gemini Flash)** — Reads the user's prompt and the current screen state, then picks the right action via function calling:
   - `generate_screen`: build a new page from scratch
   - `update_components`: edit specific components (e.g. change a color, rewrite text)
   - `regenerate_screen`: restructure the layout (add/remove sections)

2. **Executor (Gemini Pro)** — Generates the actual HTML/Tailwind for each component in parallel using `Promise.all()`.

### Why two phases?

Separating routing from generation keeps each step simple. The Router only classifies intent (fast, cheap). The Executor only writes HTML (slow, quality matters). This also lets us parallelize generation — a 5-component page fires 5 LLM calls at once instead of sequentially.

## Dual-model strategy

| Phase | Model | Role |
|---|---|---|
| Router | Gemini 2.5 Flash | Picks the tool (~1-2s) |
| Executor | Gemini 3.1 Pro | Generates HTML/Tailwind |

## Setup

```bash
npm install
```

Create a `.env.local` in the project root:

```
GEMINI_API_KEY=your_key_here
```

Run:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and type a prompt.

> See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full deep dive on tool design, data model, and streaming.

## Session model

- Each browser gets an HTTP-only cookie (`banani_session_id`).
- Server state is isolated per session ID (in-memory map).
- Session data expires after 24h of inactivity (cleanup runs on API requests).
- The UI hydrates from `GET /api/session` on page load, so refresh restores current messages/screen.
- Reset only clears the current browser session.

## Quality checks

```bash
npm run lint
npm run test
npm run test:coverage
npm run build
```

### Test stack

- Vitest
- Testing Library (React + user-event)
- API route tests with mocked agent calls (no live LLM dependency)

## CI

A local CI workflow is included at:

`.github/workflows/ci.yml`

It runs `npm ci`, `npm run lint`, `npm run test:coverage`, and `npm run build` on push and pull requests.

## Bonus features

- **Component highlighting**: hover a component in the sidebar to highlight it in the preview
- **Element inspector**: expand any component to see its inner elements (headings, buttons, links...)
- **Scoped editing**: click the edit icon on any component or element to pre-fill a targeted prompt
- **Loading feedback**: a skeleton placeholder animates while the first screen generates; on follow-up prompts, a translucent overlay with a spinner keeps the previous preview visible so the user never stares at a blank canvas
- **Automatic retries**: if the Gemini API returns a transient error (503, timeout), the Executor retries up to 3 times with exponential backoff — no manual refresh needed

## Known limitations

Components are generated in parallel by independent LLM calls, so minor visual inconsistencies can appear (e.g. slightly different spacing or colors). This is mitigated by a shared `style_guide` that the Router produces and passes to every Executor call.

Session storage is process-memory only. Restarting the app clears all sessions. For production, replace with Redis or a persistent store.

A natural next step would be a layout template phase: generate a lightweight HTML skeleton with named slots before running the Executor, so each component knows its exact position.
