import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getCredits } from "@/lib/sheets";
import { sanitizeEmail } from "@/lib/validation";

export async function GET() {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json(
      { error: "Autenticación requerida" },
      { status: 401 }
    );
  }

  const email = sanitizeEmail(session.user.email);

  try {
    const result = await getCredits(email);
    return NextResponse.json({
      credits: result?.credits ?? 0,
      name: result?.name ?? "",
      packSize: result?.packSize ?? null,
    });
  } catch (err) {
    console.error("[credits] Error fetching credits:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
