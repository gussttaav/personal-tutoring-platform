// ARCH-11 — Redis-backed implementation of ISessionRepository.
// Uses kv directly; session TTL derived from getSessionDurationWithGrace.
import type { ISessionRepository } from "@/domain/repositories/ISessionRepository";
import type { ZoomSession } from "@/domain/types";
import { kv } from "@/infrastructure/redis/client";
import { getSessionDurationWithGrace } from "@/infrastructure/zoom/jwt";

export class RedisSessionRepository implements ISessionRepository {
  async createSession(eventId: string, session: ZoomSession): Promise<void> {
    const ttl = getSessionDurationWithGrace(session.sessionType) * 60 + 86_400;
    await kv.set(`zoom:session:${eventId}`, session, { ex: ttl });
  }

  async findByEventId(eventId: string): Promise<ZoomSession | null> {
    return kv.get<ZoomSession>(`zoom:session:${eventId}`);
  }

  async deleteByEventId(eventId: string): Promise<void> {
    await kv.del(`zoom:session:${eventId}`);
  }

  async appendChatMessage(eventId: string, message: string): Promise<number> {
    const listKey = `chat:session:${eventId}`;
    const len = await kv.rpush(listKey, message);
    if (len === 1) {
      await kv.expire(listKey, 86_400);
    }
    return len;
  }

  async listChatMessages(eventId: string, from: number, to: number): Promise<string[]> {
    return kv.lrange<string>(`chat:session:${eventId}`, from, to);
  }

  async countChatMessages(eventId: string): Promise<number> {
    return kv.llen(`chat:session:${eventId}`);
  }
}
