import { google } from "googleapis";
import type { CreditResult, PackSize } from "@/types";
import { PACK_SIZES, PACK_VALIDITY_MONTHS } from "@/constants";

// ─── Column indices (0-based) — change here if sheet schema changes ───────────
const COL = {
  email: 0,
  name: 1,
  credits: 2,
  packLabel: 3,
  expiresAt: 4,
  lastUpdated: 5,
} as const;

const SHEET_RANGE = "Alumnos!A2:F";
const SHEET_ID = process.env.GOOGLE_SHEET_ID!;

// ─── Singleton auth client ────────────────────────────────────────────────────
let _sheetsClient: ReturnType<typeof google.sheets> | null = null;

async function getSheets() {
  // Do not cache — googleapis handles token refresh internally.
  // A cached client silently breaks after the 1-hour OAuth token expiry.
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function isExpired(expiresAt: string): boolean {
  if (!expiresAt) return false;
  return new Date() > new Date(expiresAt);
}

function rowToEmail(row: string[]): string {
  return row[COL.email]?.toLowerCase() ?? "";
}

/**
 * Parses the pack size from a packLabel string like "Pack 5 clases" or "Pack 10 clases".
 * Returns null if the label doesn't match a known pack size.
 */
function parsePackSize(packLabel: string): PackSize | null {
  for (const size of PACK_SIZES) {
    if (packLabel.includes(String(size))) return size;
  }
  return null;
}

async function fetchAllRows(): Promise<{
  rows: string[][];
  sheets: ReturnType<typeof google.sheets>;
}> {
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: SHEET_RANGE,
  });
  return { rows: (res.data.values as string[][]) ?? [], sheets };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getCredits(email: string): Promise<CreditResult | null> {
  const { rows } = await fetchAllRows();
  const row = rows.find((r) => rowToEmail(r) === email.toLowerCase());
  if (!row) return null;

  const expiresAt = row[COL.expiresAt] ?? "";
  const credits = isExpired(expiresAt) ? 0 : parseInt(row[COL.credits] ?? "0", 10);
  const packLabel = row[COL.packLabel] ?? "";
  const packSize = parsePackSize(packLabel);

  return { credits, name: row[COL.name] ?? "", packSize, expiresAt };
}

export async function addOrUpdateStudent(
  email: string,
  name: string,
  creditsToAdd: number,
  packLabel: string
): Promise<void> {
  const { rows, sheets } = await fetchAllRows();
  const rowIndex = rows.findIndex((r) => rowToEmail(r) === email.toLowerCase());

  const now = new Date();
  const expiresAt = addMonths(now, PACK_VALIDITY_MONTHS).toISOString();
  const nowStr = now.toISOString();

  if (rowIndex >= 0) {
    const currentExpires = rows[rowIndex][COL.expiresAt] ?? "";
    const baseCredits =
      currentExpires && isExpired(currentExpires)
        ? 0
        : parseInt(rows[rowIndex][COL.credits] ?? "0", 10);

    const sheetRow = rowIndex + 2;
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `Alumnos!A${sheetRow}:F${sheetRow}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [
          [email, name, baseCredits + creditsToAdd, packLabel, expiresAt, nowStr],
        ],
      },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: "Alumnos!A2",
      valueInputOption: "RAW",
      requestBody: {
        values: [[email, name, creditsToAdd, packLabel, expiresAt, nowStr]],
      },
    });
  }
}

export async function decrementCredit(
  email: string
): Promise<{ ok: boolean; remaining: number }> {
  const { rows, sheets } = await fetchAllRows();
  const rowIndex = rows.findIndex((r) => rowToEmail(r) === email.toLowerCase());

  if (rowIndex < 0) return { ok: false, remaining: 0 };

  const expiresAt = rows[rowIndex][COL.expiresAt] ?? "";
  if (expiresAt && isExpired(expiresAt)) return { ok: false, remaining: 0 };

  const currentCredits = parseInt(rows[rowIndex][COL.credits] ?? "0", 10);
  if (currentCredits <= 0) return { ok: false, remaining: 0 };

  const newCredits = currentCredits - 1;
  const sheetRow = rowIndex + 2;

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `Alumnos!A${sheetRow}:F${sheetRow}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [
        [
          rows[rowIndex][COL.email],
          rows[rowIndex][COL.name],
          newCredits,
          rows[rowIndex][COL.packLabel],
          rows[rowIndex][COL.expiresAt],
          new Date().toISOString(),
        ],
      ],
    },
  });

  return { ok: true, remaining: newCredits };
}
