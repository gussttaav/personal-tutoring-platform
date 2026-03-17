import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { decrementCredit } from "@/lib/kv";

export async function POST(req: NextRequest) {
  // ── Auth check ────────────────────────────────────────────────────────────
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json(
      { error: "Debes iniciar sesión para continuar" },
      { status: 401 }
    );
  }

  const email = session.user.email;

  try {
    const result = await decrementCredit(email);
    if (!result.ok) {
      return NextResponse.json(
        { error: "Sin créditos disponibles" },
        { status: 400 }
      );
    }
    return NextResponse.json({ ok: true, remaining: result.remaining });
  } catch (err) {
    console.error("[book] Error decrementing credit in KV:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
