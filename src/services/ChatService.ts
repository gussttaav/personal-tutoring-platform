// ARCH-16: ChatService — wraps the chat model client for dependency injection and testability.
// REFACTOR-P2-03: History moved server-side; client supplies opaque sessionId.
//   Previously the client sent the full conversation history on every request,
//   allowing injection of fake model turns. Now history lives in Redis keyed by
//   a server-generated UUID. The client never touches history directly.
// CHAT-CLAUDE-01: the model is Claude (was Gemini). History is stored in the
//   provider-neutral ChatTurn shape under a new key prefix, so conversations saved
//   in Gemini's shape before the switch are never sent to Claude; they expire on
//   their 1-hour TTL.
// CHAT-AGENT-P1-02: the injected tools (none yet) and the route's ToolContext are
//   passed to the model; the reply's `actions` go back to the route. History stays
//   text-only (no tool or thinking blocks); an assistant turn that showed actions
//   keeps a one-line `actionsSummary` so the model remembers what it offered.
//   The field is optional, so `chat:hist:v2:` stays compatible.
// CHAT-AGENT-P1-02c: the summary is written on the VISITOR's clock: each slot as the
//   local label the reply used plus a `start_iso` carrying the visitor's offset, and the
//   timezone named. It used to list bare UTC instants, which the model read against the
//   local times in its own reply and "corrected" them (2 of 5 live Bogotá conversations,
//   2026-11-09). The tool results themselves never reach the history.
// REFACTOR-R5-P2-01: everything /api/chat did besides HTTP lives in reply(): the
//   student's prices (one PricingService.resolve(), was two user_pricing reads per
//   turn), the system prompt, the ToolContext + contextNote, and the daily kill switch
//   (`chat:requests:<UTC date>`, pre-check + `incrby` by model calls). Identity still
//   comes from the server session the route passes in (CHAT-AGENT-P1-02), never from
//   the body. The Next ISR loaders (display prices, schedule) stay in the route and
//   arrive as `display`.
import type {
  IChatModelClient,
  ChatTurn,
  ChatTool,
  ChatAction,
  ToolContext,
} from "@/infrastructure/anthropic";
import { kv } from "@/infrastructure/redis/client";
import { formatInTimeZone } from "date-fns-tz";
import { localLabel } from "./chat-tools/free-call-tools";
import { buildChatSystemPrompt, type ChatPromptContent } from "@/constants/chat-prompt";
import { buildContextNote } from "@/lib/chat-context-note";
import { DEFAULT_JOIN_OPEN_MINUTES, DEFAULT_TUTOR_ABSENT_ALERT_MINUTES } from "@/lib/booking-config"; // SESSION-JOIN-01
import type { DisplayPrices } from "@/lib/pricing-format";
import type { ScheduleConfig } from "@/domain/types";
import { ChatCapacityError } from "@/domain/errors";
import { log } from "@/lib/logger";
import type { EffectivePriceCents } from "./PricingService";

const MAX_HISTORY_TURNS = 10;
const HISTORY_TTL_SEC   = 3600; // 1-hour idle timeout

const MAX_DAILY_CHAT_REQUESTS = 1000; // model calls per day (CHAT-AGENT-P1-02)

/** The counter's day is UTC: an ops convention, not the tutor's timezone. */
function todayKey(): string {
  return `chat:requests:${new Date().toISOString().slice(0, 10)}`;
}

/** REFACTOR-R5-P2-01: the two lookups reply() needs (UserService, PricingService). */
export interface ChatUserLookup {
  findByEmail(email: string): Promise<{ id: string } | null>;
}
export interface ChatPriceSource {
  getEffectivePriceCents(userId?: string): Promise<EffectivePriceCents>;
}

/** REFACTOR-R5-P2-01: one chat turn, as the route hands it over. */
export interface ChatReplyRequest {
  message:   string;
  sessionId: string | null;   // null = new conversation
  email:     string | null;   // from the server session, never from the body
  timezone?: string;          // already validated against SUPPORTED_TIMEZONES
  voice?:    boolean;         // CHAT-AGENT-P2-02
  locale:    "es" | "en";     // NEXT_LOCALE cookie
  /** The route's cached (ISR) reads + the registry content. */
  display: {
    prices:           DisplayPrices;
    packValidityDays: number;
    schedule:         ScheduleConfig;
    content:          ChatPromptContent;
  };
}

export interface ChatReplyResult {
  reply:     string;
  sessionId: string;
  actions:   ChatAction[];
  timezone:  string; // CHAT-AGENT-P1-04: the one the tools used
}

/** An instant as ISO-8601 on the visitor's clock, e.g. "2026-11-04T10:00:00+01:00". */
function localIso(iso: string, timezone: string): string {
  return formatInTimeZone(new Date(iso), timezone, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

/**
 * One line for the model, on the visitor's clock, e.g.
 * "Ofrecí huecos de 15 min, en hora de Europe/Madrid: mié 4 nov · 10:00 (start_iso
 * 2026-11-04T10:00:00+01:00); Propuse (free15min), en hora de Europe/Madrid: …".
 */
export function summarizeActions(
  actions: ChatAction[],
  ctx: Pick<ToolContext, "locale" | "timezone">,
): string | undefined {
  const slot = (iso: string) => `${localLabel(new Date(iso), ctx)} (start_iso ${localIso(iso, ctx.timezone)})`;
  const parts = actions.map((a) =>
    a.type === "proposal"
      ? `Propuse (${a.sessionType}), en hora de ${ctx.timezone}: ${slot(a.startIso)}`
      : `Ofrecí huecos de ${a.durationMinutes} min, en hora de ${ctx.timezone}: ${a.slots.map((s) => slot(s.startIso)).join(", ") || "ninguno"}`,
  );
  return parts.length > 0 ? parts.join("; ") : undefined;
}

export class ChatService {
  constructor(
    private readonly model:   IChatModelClient,
    private readonly tools:   ChatTool[],
    private readonly users:   ChatUserLookup,
    private readonly pricing: ChatPriceSource,
  ) {}

  /**
   * REFACTOR-R5-P2-01: one chat turn end to end. Throws ChatCapacityError (model not
   * called, nothing counted) when today's cap is reached; any other error propagates
   * after counting the failed turn as one model call.
   */
  async reply(req: ChatReplyRequest): Promise<ChatReplyResult> {
    const key = todayKey();
    // REFACTOR-P2-03: daily spend kill switch. Per-IP rate limits cap individual
    // abusers; this caps total cost across all users for the day.
    // CHAT-AGENT-P1-02: checked here, counted after the call (by model calls).
    const todaySpend = (await kv.get<number>(key)) ?? 0;
    if (todaySpend >= MAX_DAILY_CHAT_REQUESTS) {
      log("error", "Chat daily request cap exceeded — circuit open", {
        service: "chat",
        todaySpend,
        limit: MAX_DAILY_CHAT_REQUESTS,
      });
      throw new ChatCapacityError();
    }

    let modelCalls = 0;
    try {
      // CHAT-AGENT-P1-02: one lookup serves the private prices and the ToolContext.
      const user = req.email ? await this.users.findByEmail(req.email) : null;

      // PRICING-STUDENT-01: a signed-in student may pay a private price; quote theirs,
      // or the assistant would contradict the page they are looking at. One resolve()
      // (a `pricing` + a `user_pricing` read); anonymous visitors keep the cached
      // public figures the route passed in.
      const { prices } = req.display;
      const priceCents: EffectivePriceCents = user
        ? await this.pricing.getEffectivePriceCents(user.id)
        : {
            session1h: prices.session1h.priceCents,
            session2h: prices.session2h.priceCents,
            pack5:     prices.pack5.priceCents,
            pack10:    prices.pack10.priceCents,
          };

      const { schedule } = req.display;
      const systemPrompt = buildChatSystemPrompt(
        {
          ...priceCents,
          packValidityDays: req.display.packValidityDays,
          cancelHours:      schedule.cancelMinNoticeHours,
          // SESSION-JOIN-01: `??` covers a config cached before migration 0028.
          joinOpenMinutes:         schedule.joinOpenMinutesBefore ?? DEFAULT_JOIN_OPEN_MINUTES,
          tutorAbsentAlertMinutes: schedule.tutorAbsentAlertMinutes ?? DEFAULT_TUTOR_ABSENT_ALERT_MINUTES,
        },
        req.display.content,
      );

      // CHAT-AGENT-P1-02: identity comes from the session, never from tool input.
      const toolContext: ToolContext = {
        userId:   user?.id ?? null,
        email:    req.email,
        timezone: req.timezone ?? schedule.timezone,
        locale:   req.locale,
        now:      new Date(),
      };

      const result = await this.ask({
        message:     req.message,
        sessionId:   req.sessionId,
        systemPrompt,
        toolContext,
        contextNote: buildContextNote(toolContext, { voice: req.voice }), // CHAT-AGENT-P2-02
      });
      modelCalls = result.modelCalls;
      log("info", "Chat reply", {
        service: "chat", modelCalls, actions: result.actions.map((a) => a.type),
      });
      return {
        reply:     result.reply,
        sessionId: result.sessionId,
        actions:   result.actions,
        timezone:  toolContext.timezone,
      };
    } catch (err) {
      // A failed turn counts as one call, as every request did before the tool loop.
      modelCalls = 1;
      throw err;
    } finally {
      await this.countModelCalls(key, modelCalls);
    }
  }

  /** CHAT-AGENT-P1-02: adds this reply's model calls to today's kill-switch counter. */
  private async countModelCalls(key: string, modelCalls: number): Promise<void> {
    try {
      const total = await kv.incrby(key, modelCalls);
      if (total === modelCalls) await kv.expire(key, 86400);
    } catch (err) {
      log("warn", "Chat kill-switch counter not updated", { service: "chat", error: String(err) });
    }
  }

  async ask(params: {
    message:      string;
    sessionId:    string | null; // null = new conversation
    systemPrompt: string;
    toolContext:  ToolContext;
    contextNote?: string;
  }): Promise<{ reply: string; sessionId: string; actions: ChatAction[]; modelCalls: number }> {
    const sessionId  = params.sessionId ?? crypto.randomUUID();
    const historyKey = `chat:hist:v2:${sessionId}`;

    const stored  = (await kv.get<ChatTurn[]>(historyKey)) ?? [];
    const trimmed = stored.slice(-MAX_HISTORY_TURNS * 2); // 10 user+assistant pairs

    const { text: reply, actions, modelCalls } = await this.model.chat(
      params.systemPrompt,
      trimmed,
      params.message,
      {
        tools:       this.tools,
        toolContext: params.toolContext,
        contextNote: params.contextNote,
      },
    );

    const actionsSummary = summarizeActions(actions, params.toolContext);
    const allTurns: ChatTurn[] = [
      ...trimmed,
      { role: "user",      text: params.message },
      { role: "assistant", text: reply, ...(actionsSummary ? { actionsSummary } : {}) },
    ];
    const updated = allTurns.slice(-MAX_HISTORY_TURNS * 2);

    await kv.set(historyKey, updated, { ex: HISTORY_TTL_SEC });

    return { reply, sessionId, actions, modelCalls };
  }
}
