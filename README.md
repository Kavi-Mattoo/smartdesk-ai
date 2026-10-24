# SmartDesk AI - Customer Support & Ticket Management

SmartDesk AI is a full-stack support-desk application. Agents can log customer tickets, track their status and priority, search and filter the queue, and draft replies with an optional AI assistant that falls back to rule-based templates.

**Problem:** small support teams juggle requests in inboxes and spreadsheets. SmartDesk AI gives them one place to see what is open, what is urgent, and how to respond.

## Features

- Dashboard with total / open / in-progress / resolved / urgent-unresolved counts, a status summary bar and recent activity
- Ticket list with search (subject, customer, email, ID) and filters (status, priority, category)
- Ticket detail view: customer, description, category, timestamps, editable status / priority / category
- Create-ticket form with client- and server-side validation
- Delete with a confirmation dialog
- Suggested replies: editable, copyable, or opened in your email app
  - **Real AI** (optional): server-side call to the Anthropic Messages API when `ANTHROPIC_API_KEY` is set
  - **Rule-based fallback**: used when there is no key or the provider fails (rate limit, timeout, error). Every suggestion is labelled with its source.
- Loading, empty, success and error states; responsive layout (laptop, tablet, mobile); keyboard-accessible forms and dialogs

## Tech stack and architecture

| Layer | Technology |
| --- | --- |
| Frontend | React 18, TypeScript, Vite, plain CSS, lucide-react icons, hash-based routing (no router dependency) |
| Backend | Node.js 20+, Express 4, cors, dotenv |
| Storage | JSON file (`server/data/tickets.json`), written atomically and serialized per process |
| Tests | Node's built-in test runner (`node --test`), no extra test framework |

```
Browser --/api--> Vite dev proxy --> Express API --> store.js --> tickets.json
                                          \--> replies.js --> (optional) AI provider, else rule-based
```

In development the browser talks to Vite (port 5173), which proxies `/api` to Express (port 5000). After `npm run build`, Express also serves `client/dist`, so a single process can host the whole app.

## Folder structure

```
smartdesk-ai/
  client/                 React + TypeScript app
    src/
      components/         Sidebar, dialogs, create form, reply assistant, toasts, badges
      pages/              Dashboard, Tickets list, Ticket detail
      hooks/              Hash router, API health polling
      api.ts types.ts validation.ts utils.ts styles.css App.tsx main.tsx
  server/
    src/                  app.js (routes), store.js, validation.js, replies.js, config.js, index.js
    data/seed.json        Demo tickets (copied to tickets.json on first run)
    test/                 Automated tests
  .env.example  .gitignore  package.json  README.md
```

## Prerequisites

- Node.js 20 or newer and npm (check with `node -v`)
- No database, account or paid service is required

## Install and run

```bash
npm run install:all
cp .env.example .env     # optional; Windows: copy .env.example .env
npm run dev
```

- App: http://localhost:5173
- API health: http://localhost:5000/api/health

The first start creates `server/data/tickets.json` from `server/data/seed.json`. To reset the demo data, stop the server and delete `tickets.json`.

### Production-style run (single process)

```bash
npm run build
npm start        # serves the API and the built client at http://localhost:5000
```

## Environment variables

Defined in `.env` at the repository root (see `.env.example`). All are optional.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `5000` | API port (update the proxy in `client/vite.config.ts` if you change it) |
| `CLIENT_ORIGIN` | `http://localhost:5173,http://127.0.0.1:5173` | Allowed browser origins for CORS |
| `DATA_FILE` | `server/data/tickets.json` | Ticket storage file |
| `ANTHROPIC_API_KEY` | empty | Enables real AI replies. Server-side only, never sent to the browser |
| `ANTHROPIC_MODEL` | `claude-haiku-5-5` | Model for AI replies; change it if your account uses another model |
| `AI_TIMEOUT_MS` | `15000` | Provider timeout before falling back |

The client has one optional variable, `VITE_API_URL` (in `client/.env`), only needed if the API is hosted on a different origin.

## API

All responses are JSON. Errors look like `{ "error": "message", "details": { "field": "message" } }`.

| Method | Route | Description | Success |
| --- | --- | --- | --- |
| GET | `/api/health` | Service status and whether AI is configured (`aiEnabled`) | 200 |
| GET | `/api/stats` | Dashboard counts and 5 most recently updated tickets | 200 |
| GET | `/api/tickets` | List tickets. Query: `q`, `status`, `priority`, `category` | 200 |
| GET | `/api/tickets/:id` | One ticket | 200 / 404 |
| POST | `/api/tickets` | Create. Body: `subject`, `customer`, `email`, `description`, optional `category`, `priority` | 201 / 400 |
| PATCH | `/api/tickets/:id` | Update `status`, `priority` and/or `category` | 200 / 400 / 404 |
| DELETE | `/api/tickets/:id` | Delete | 204 / 404 |
| POST | `/api/tickets/:id/suggest-reply` | Suggested reply: `{ reply, source: "ai" or "rule-based", label, fallbackReason?, fallbackMessage? }` | 200 / 404 |

Allowed values: status `Open`, `In Progress`, `Resolved`; priority `Low`, `Medium`, `High`, `Urgent`; category `Account`, `Billing`, `Technical`, `Feature Request`, `Other`. Malformed JSON returns 400, oversized bodies 413.

## Testing

```bash
npm test               # backend tests
npm run typecheck      # TypeScript check for the client
npm run build          # production build of the client
```

Backend tests cover validation, the store (CRUD, persistence, concurrent creates), the reply service (fallback, provider errors, timeout, mocked AI success) and the HTTP API (health, listing, valid/invalid create, update, missing tickets, delete, suggest-reply).

## Screenshots

_Screenshots have not been captured yet. Add images to `docs/screenshots/` and reference them here after running the app:_

- Dashboard: _placeholder_
- Ticket list: _placeholder_
- Ticket detail with suggested reply: _placeholder_

## Limitations and future improvements

- No authentication or multi-user support; anyone who can reach the server can change tickets.
- JSON-file storage suits a single-process demo, not production. A database (SQLite/PostgreSQL) would be the next step.
- The highest ticket ID is reused if that ticket is deleted.
- The AI integration is covered only by tests with a mocked provider; it has not been exercised against the live API. Try it with your own key before relying on it.
- No rate limiting on `suggest-reply`; add it before exposing an AI key publicly.
- Replies are drafts only; the app does not send email.
- Possible additions: reply history, assignees, pagination, ticket comments, end-to-end browser tests.
