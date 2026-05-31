/**
 * REFACTOR-P3-01: Channel handshake endpoint.
 *
 * Returns the per-eventId Realtime channel name (HMAC over eventId) plus the
 * full message backlog so the browser can seed its state and subscribe to live
 * updates. Replaces the previous polling SSE GET handler.
 *
 * The channel name is the security boundary: only authorized participants
 * receive it. Anyone who knows the name can subscribe, so the membership check
 * here gates emission. Membership comes from sessionService.getChatMessages,
 * which throws BookingNotFoundError / UnauthorizedError when appropriate
 * (see REFACTOR-P3-04 for the underlying check).
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { sessionService } from "@/services";
import { chatChannelName } from "@/lib/realtime-channel";
import { BookingNotFoundError, UnauthorizedError } from "@/domain/errors";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Autenticación requerida" }, { status: 401 });
  }

  const eventId = req.nextUrl.searchParams.get("eventId");
  if (!eventId) {
    return NextResponse.json({ error: "Falta eventId" }, { status: 400 });
  }

  try {
    const { messages } = await sessionService.getChatMessages({
      eventId,
      userEmail: session.user.email,
      fromIndex: 0,
    });

    const initialMessages = messages
      .map((m) => {
        try { return JSON.parse(m); } catch { return null; }
      })
      .filter((m): m is Record<string, unknown> => m !== null);

    return NextResponse.json({
      channelName: chatChannelName(eventId),
      initialMessages,
    });
  } catch (err) {
    if (err instanceof BookingNotFoundError) {
      return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
    }
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
    throw err;
  }
}
