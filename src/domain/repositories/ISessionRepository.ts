// ARCH-10: Zoom session repository interface.
import type { ZoomSession } from "../types";

export interface ISessionRepository {
  /**
   * Persists a Zoom session record keyed by eventId. Overwrites any existing
   * record for the same eventId (last-write-wins; callers ensure uniqueness).
   */
  createSession(eventId: string, session: ZoomSession): Promise<void>;

  /**
   * Returns the Zoom session for a given eventId, or null if no session exists.
   * Used to gate join-token resolution and Zoom SDK token generation.
   */
  findByEventId(eventId: string): Promise<ZoomSession | null>;

  /**
   * Removes the session record for an eventId. Called after session termination
   * or cancellation. Idempotent — safe to call if the record is already gone.
   */
  deleteByEventId(eventId: string): Promise<void>;

  /**
   * Records that the student joined the session. Only writes when
   * student_joined_at is still NULL — subsequent joins are no-ops so we keep
   * the first-join timestamp. Idempotent.
   */
  markStudentJoined(eventId: string): Promise<void>;

  /**
   * Appends a chat message to the session's message list. Returns the new total
   * message count. Used by the in-session chat feature.
   */
  appendChatMessage(eventId: string, message: string): Promise<number>;

  /**
   * Returns a slice of chat messages in the range [from, to] (0-indexed, inclusive).
   * Used for paginated chat history retrieval. Returns an empty array if the
   * eventId has no messages or the range is out of bounds.
   */
  listChatMessages(eventId: string, from: number, to: number): Promise<string[]>;

  /**
   * Returns the total number of chat messages for a session. Returns 0 if the
   * eventId has no messages.
   */
  countChatMessages(eventId: string): Promise<number>;
}
