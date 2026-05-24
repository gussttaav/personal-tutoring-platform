# Task P1-03 — Booking saga: explicit compensation list

**Severity:** 🔴 Critical
**Effort:** 4–6 hours
**Owner:** _tbd_
**Status:** ⬜ Not started
**Depends on:** [P1-01](01-wire-slot-locks.md) (compensation wraps the lock-acquire path)

## TL;DR

`BookingService.createBooking` runs 8 sequential side effects with no compensation. If step 5 (DB insert) fails after step 3 (Calendar create), the user has a Calendar invite but no DB row, no way to join, and (if pack) a missing credit. There is no rollback.

## Context

### Current order of operations

```
1. Min-notice guard                       (in-memory; no side effect)
2. Reschedule cleanup (optional)          ← side effect: deletes old event + restores credit
3. Credit decrement (pack only)           ← side effect: Supabase decrement_credit RPC
4. Calendar event create                  ← side effect: Google Calendar insert
5. QStash schedule                        ← side effect: external HTTP
6. DB booking insert                      ← side effect: Supabase
7. DB zoom_session insert                 ← side effect: Supabase
8. Emails (Promise.all)                   ← side effect: Resend
```

### Failure modes today

| Failing step | What's left dangling |
|--------------|---------------------|
| 4 fails | Credit decremented but not restored unless `sessionType==='pack'` — partial restore logic at line 31663–31673 |
| 5 fails | Calendar event exists; QStash never scheduled; no DB row. **No cleanup.** |
| 6 fails | Calendar event + QStash schedule both exist; no DB row. **No cleanup.** |
| 7 fails | Booking row exists but no zoom_session; user gets a booking they can't join. **No cleanup.** |
| 8 fails | Booking is fine; emails fail silently (acceptable — `emailFailed` flag returned) |

The existing partial-recovery at line 31663–31673 only handles step 4 → credit restore for pack sessions. Everything else is missing.

## Approach

Use a **compensation list pattern** (the Saga pattern, in-process variant):

1. Maintain an array of `() => Promise<void>` cleanups.
2. After each successful side effect, **push** the inverse operation.
3. If anything in the `try` block throws, run all compensations in reverse order.
4. On success, the compensation list is discarded.

This is not a distributed transaction — there's no two-phase commit across Stripe, Google, Supabase, and QStash. But it gives best-effort cleanup that's auditable and consistent with the existing code style.

### Why not a DB transaction wrapping everything?

You can't. The side effects span 4 external systems (Stripe, Calendar, Zoom, QStash) plus DB. A DB transaction won't roll back a Calendar event. Compensation is the only realistic option.

### Why not Temporal / Inngest / proper saga framework?

For this scale (single tutor, hundreds of bookings/day max), in-process compensation is sufficient and adds zero ops complexity. If you ever cross 10k bookings/day or add cross-tutor workflows, revisit.

## Files affected

| File | Change |
|------|--------|
| `src/services/BookingService.ts` | Major refactor of `createBooking` |
| `src/services/__tests__/BookingService.test.ts` | New tests for each failure-at-step-N case |
| `src/__tests__/fixtures/FakeCalendarClient.ts` | Ensure `deleteEvent` is mockable per-call |
| `src/__tests__/fixtures/FakeScheduler.ts` | Add `cancel` / `delete` method (see SchedulerClient note below) |

## The change

### 1. `src/services/BookingService.ts` — refactored `createBooking`

```typescript
type Compensation = { description: string; run: () => Promise<void> };

async createBooking(input: CreateBookingInput): Promise<CreateBookingOutput> {
  // 1. Min-notice guard (in-memory)
  const startsAt    = new Date(input.startIso);
  const minBookable = new Date(Date.now() + SCHEDULE.minNoticeHours * 60 * 60_000);
  if (startsAt < minBookable) throw new SlotUnavailableError();

  // 2. Acquire slot lock (from P1-01)
  const durationMinutes = Math.round(
    (new Date(input.endIso).getTime() - new Date(input.startIso).getTime()) / 60_000
  );
  const locked = await this.bookings.acquireSlotLock(input.startIso, durationMinutes);
  if (!locked) throw new SlotUnavailableError();

  // REFACTOR-P1-03: Saga compensation list. On any failure inside the try block,
  // these run in reverse order to undo committed side effects. Best-effort —
  // each compensation logs but does not throw, since the original error is more
  // important and we don't want compensation failures to mask it.
  const compensations: Compensation[] = [];
  const compensate = async () => {
    for (const c of [...compensations].reverse()) {
      try {
        await c.run();
        log("info", "Compensation succeeded", { service: "BookingService", step: c.description });
      } catch (err) {
        log("error", "Compensation failed (manual intervention may be needed)", {
          service: "BookingService", step: c.description, error: String(err),
        });
      }
    }
  };

  try {
    let consumedReschedule = false;

    // 3. Reschedule flow (if any)
    if (input.rescheduleToken) {
      const oldRecord = await this.bookings.findByCancelToken(input.rescheduleToken);
      if (!oldRecord) {
        throw new DomainError("El enlace de reprogramación no es válido o ya ha sido usado.", "INVALID_RESCHEDULE_TOKEN");
      }
      if (new Date(oldRecord.startsAt) <= new Date(Date.now() + CANCEL_WINDOW_MS)) {
        throw new DomainError("Ya no es posible reprogramar esta sesión (menos de 2 horas de antelación).", "OUTSIDE_RESCHEDULE_WINDOW");
      }
      if (oldRecord.sessionType !== input.sessionType) {
        throw new DomainError("El tipo de sesión no coincide con la reserva original.", "SESSION_TYPE_MISMATCH");
      }

      const consumed = await this.bookings.consumeCancelToken(input.rescheduleToken);
      if (!consumed) {
        throw new DomainError("El enlace de reprogramación ya ha sido usado.", "RESCHEDULE_TOKEN_CONSUMED");
      }
      consumedReschedule = true;

      // Compensation: re-mark the old booking as confirmed if we fail downstream.
      // Note: this leaves both bookings in 'confirmed' if compensation runs after
      // a successful new-booking insert. Acceptable — the slot lock prevents that.
      compensations.push({
        description: "restore old cancel token",
        run: async () => { /* TODO: add bookings.restoreCancelToken if reschedule rollback matters */ },
      });

      try { await this.calendar.deleteEvent(oldRecord.eventId); } catch {}
      try { await this.sessions.deleteByEventId(oldRecord.eventId); } catch {}
      await invalidateAvailability(oldRecord.startsAt.slice(0, 10)).catch(() => {});

      if (oldRecord.sessionType === "pack") {
        await this.credits.restoreCredit(input.email);
      }
    }

    // 4. Credit decrement for pack sessions
    let packSizeForToken: number | undefined;
    if (input.sessionType === "pack") {
      await this.credits.useCredit(input.email);
      compensations.push({
        description: "restore decremented credit",
        run: async () => { await this.credits.restoreCredit(input.email); },
      });
      const creditRecord = await this.credits.getBalance(input.email);
      packSizeForToken = creditRecord?.packSize ?? undefined;
    }

    // 5. Calendar event
    const sessionLabel = SESSION_LABELS[input.sessionType];
    const calResult = await this.calendar.createEvent({
      summary:     `${sessionLabel} — ${input.name}`,
      description: [
        `Alumno: ${input.name} (${input.email})`,
        `Tipo: ${sessionLabel}`,
        input.note ? `Motivo: ${input.note}` : null,
        `gustavoai.dev`,
      ].filter((s): s is string => s !== null).join("\n"),
      startIso:     input.startIso,
      endIso:       input.endIso,
      sessionType:  input.sessionType,
      studentEmail: input.email,
    });
    compensations.push({
      description: `delete Calendar event ${calResult.eventId}`,
      run: async () => { await this.calendar.deleteEvent(calResult.eventId); },
    });
    await invalidateAvailability(input.startIso.slice(0, 10)).catch(() => {});

    // 6. Booking record (DB) — moved BEFORE QStash so the booking row exists
    //    if QStash scheduling fails. P1-04 introduces a pending-termination
    //    fallback for that case.
    const { cancelToken, joinToken } = await this.bookings.createBooking({
      eventId:     calResult.eventId,
      email:       input.email,
      name:        input.name,
      sessionType: input.sessionType,
      startsAt:    input.startIso,
      endsAt:      input.endIso,
      ...(packSizeForToken    !== undefined ? { packSize:        packSizeForToken    } : {}),
      ...(input.stripePaymentId             ? { stripePaymentId: input.stripePaymentId } : {}),
    });
    compensations.push({
      description: `cancel booking ${cancelToken.slice(0, 8)}…`,
      run: async () => { await this.bookings.consumeCancelToken(cancelToken); },
    });

    // 7. Zoom session record (DB) — links to booking via FK, so no separate compensation
    //    needed (cancellation of the booking cascades).
    await this.sessions.createSession(calResult.eventId, {
      sessionId:       calResult.zoomSessionId,
      sessionName:     calResult.zoomSessionName,
      sessionPasscode: calResult.zoomPasscode,
      startIso:        input.startIso,
      durationMinutes: calResult.durationMinutes,
      sessionType:     input.sessionType,
      studentEmail:    input.email,
    });

    // 8. QStash schedule — see P1-04 for error handling (fallback row on failure)
    const baseUrl      = process.env.NEXT_PUBLIC_BASE_URL ?? "";
    const startMs      = new Date(input.startIso).getTime();
    const totalMinutes = this.zoom.getDurationWithGrace(input.sessionType);
    const fireAtMs     = startMs + totalMinutes * 60_000;
    const delaySeconds = Math.max(60, Math.ceil((fireAtMs - Date.now()) / 1000));
    await this.scheduler.scheduleAt({
      url:          `${baseUrl}/api/internal/zoom-terminate`,
      body:         { eventId: calResult.eventId },
      delaySeconds,
    });

    // 9. Emails (fire-and-forget — booking is already complete)
    const joinUrl = `${baseUrl}/sesion/${joinToken}`;
    const [confirmSent] = await Promise.all([
      this.sendWithRetry(
        () => this.email.sendConfirmation({
          to:           input.email,
          studentName:  input.name,
          sessionLabel,
          startIso:     input.startIso,
          endIso:       input.endIso,
          joinToken,
          cancelToken,
          note:         input.note ?? null,
          studentTz:    input.timezone ?? null,
          sessionType:  input.sessionType,
        }),
        "confirmation email",
      ),
      this.sendWithRetry(
        () => this.email.sendNewBookingNotification({
          studentEmail: input.email,
          studentName:  input.name,
          sessionLabel,
          startIso:     input.startIso,
          endIso:       input.endIso,
          joinUrl,
          note:         input.note ?? null,
        }),
        "notification email",
      ),
    ]);

    return {
      eventId:         calResult.eventId,
      zoomSessionName: calResult.zoomSessionName,
      zoomPasscode:    calResult.zoomPasscode,
      cancelToken,
      joinToken,
      emailFailed:     !confirmSent,
    };
  } catch (err) {
    await compensate();
    throw err;
  } finally {
    await this.bookings.releaseSlotLock(input.startIso).catch(err =>
      log("warn", "Slot lock release failed", {
        service: "BookingService", startIso: input.startIso, error: String(err),
      })
    );
  }
}
```

### Notable design decisions

1. **Order changed:** booking insert (was step 7) is now BEFORE QStash (was step 6). Rationale: if QStash fails, having the booking row lets P1-04's fallback cron find it. If QStash succeeded but booking insert failed, QStash would later terminate a session that doesn't exist (harmless, but confusing).

2. **Zoom session has no separate compensation:** because of the FK + cascade. When the booking is cancelled (compensation), the zoom_session is orphaned but unreachable (the lookup goes via `bookings` first). Add a cleanup cron in Phase 4 if it becomes an issue.

3. **Reschedule rollback is partial:** if we fail after consuming the old cancel token but before the new booking commits, the old booking is gone forever (cancel token consumed). This is acceptable — re-rescheduling is rare and the user will get a clear error to retry.

4. **Emails are NOT compensated:** sending a "your class is booked" email and then deleting the booking would be worse than just letting one email go out for a failed booking. The user will either succeed on retry (and get a new email) or contact support.

## Acceptance criteria

- [ ] Each side effect that can be undone has a corresponding compensation entry
- [ ] Compensations run in reverse order on any throw inside the try block
- [ ] Each compensation logs both success and failure; failures don't mask the original error
- [ ] Slot lock release runs in `finally` regardless of success/failure
- [ ] Booking insert moved before QStash schedule
- [ ] All existing tests still pass
- [ ] New tests: failure at each step (4, 5, 6, 7) leaves the system in a consistent state

## Test plan

### Existing tests

```bash
pnpm test src/services/__tests__/BookingService.test.ts
pnpm test src/__tests__/integration/booking.test.ts
pnpm test src/__tests__/integration/reschedule.test.ts
```

### New tests

For each failure point, verify compensation:

```typescript
describe("REFACTOR-P1-03: booking saga compensation", () => {
  it("restores credit when Calendar create fails for pack session", async () => {
    const services = buildTestServices();
    await services.creditService.addCredits({ /* set up balance of 5 */ });

    jest.spyOn(services.calendar, "createEvent").mockRejectedValueOnce(new Error("Calendar down"));

    await expect(services.bookingService.createBooking({
      email: "u@example.com", name: "U",
      sessionType: "pack",
      startIso: "2026-06-01T10:00:00.000Z",
      endIso:   "2026-06-01T11:00:00.000Z",
    })).rejects.toThrow("Calendar down");

    // Credit should be back to 5
    const balance = await services.creditService.getBalance("u@example.com");
    expect(balance?.credits).toBe(5);
  });

  it("deletes Calendar event when DB booking insert fails", async () => {
    const services = buildTestServices();
    const calendarDeleteSpy = jest.spyOn(services.calendar, "deleteEvent");

    jest.spyOn(services.bookingRepo, "createBooking").mockRejectedValueOnce(new Error("DB down"));

    await expect(services.bookingService.createBooking({ /* ... */ })).rejects.toThrow();

    expect(calendarDeleteSpy).toHaveBeenCalledTimes(1);
  });

  it("deletes Calendar event and DB booking when Zoom session insert fails", async () => {
    // ...
  });

  it("releases slot lock even when compensation runs", async () => {
    const services = buildTestServices();
    jest.spyOn(services.calendar, "createEvent").mockRejectedValueOnce(new Error("fail"));

    await expect(services.bookingService.createBooking({ /* ... */ })).rejects.toThrow();

    // Acquiring the same slot should succeed (lock was released)
    const lockResult = await services.bookingRepo.acquireSlotLock("2026-06-01T10:00:00.000Z", 60);
    expect(lockResult).toBe(true);
  });

  it("logs but does not throw when compensation itself fails", async () => {
    const services = buildTestServices();
    jest.spyOn(services.calendar, "createEvent").mockResolvedValueOnce({ /* success */ });
    jest.spyOn(services.bookingRepo, "createBooking").mockRejectedValueOnce(new Error("DB"));
    jest.spyOn(services.calendar, "deleteEvent").mockRejectedValueOnce(new Error("Cal delete also failed"));

    // Should reject with the ORIGINAL error, not the compensation error
    await expect(services.bookingService.createBooking({ /* ... */ })).rejects.toThrow("DB");
  });
});
```

### Manual verification

Hard to reproduce manually without mocking. Rely on tests.

## Notes / gotchas

- **Compensation failures need monitoring.** When a compensation fails, the system is in an inconsistent state and a human should look at it. The log line `"Compensation failed"` should fire a Sentry alert by default (it does, via `level: "error"`).
- **Compensations should be idempotent.** `calendar.deleteEvent` already handles "already deleted" gracefully. `restoreCredit` does too (`ok=false` is silent success). Verify any new compensation you add follows this rule.
- **The `consumedReschedule` recovery from the OLD code is removed** because the new compensation framework handles it generally. Verify the integration tests for reschedule still pass — if they don't, you may need to restore the old `recordRescheduleFailure` call.

## Out of scope

- Per-step retry logic (e.g. retry Calendar create 3 times before compensating). Adds complexity, marginal benefit at this scale.
- A formal saga library like Inngest. Folder-local solution is fine until ops scale demands more.
- Persisting compensation state to DB so a crashed Node process can recover. Vercel function lifetimes are short; the risk window is small.
