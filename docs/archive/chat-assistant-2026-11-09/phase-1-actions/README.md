# Phase 1: actions (book the free intro call from the chat)

**Outcome:** a visitor asks «¿tienes hueco el martes para la llamada gratuita?», the assistant
lists the free 15-minute slots, proposes one, and the visitor books it with one tap inside the
chat panel, through the same `/api/book` as the booking wizard.

| Task | What | Depends on |
|------|------|------------|
| [P1-01](01-availability-service.md) | Move the availability lookup out of `/api/availability` into `AvailabilityService` | — |
| [P1-02](02-chat-tool-loop.md) | Provider-neutral tools + a bounded tool loop in `ClaudeClient`; `/api/chat` returns `actions` | — |
| [P1-03](03-free-call-tools.md) | `find_free_call_slots`, `propose_free_call`, per-request context, prompt section | P1-01, P1-02 |
| [P1-04](04-confirmation-card.md) | Render `slots` as chips and `proposal` as a confirmation card in `Chat.tsx` | P1-03 |

P1-01 and P1-02 can run in parallel.

## Invariants for the whole phase

- No tool has a side effect. The only write is the user's click → `/api/book`.
- Tool input never carries an identity. Who is asking comes from `getSession()` in the route,
  passed down as `ToolContext`.
- A tool failure becomes an `is_error` tool result the model can explain, never a 502 for the
  whole turn (unless the model call itself fails).
- One request stays inside the serverless time limit: one deadline for the whole loop.
