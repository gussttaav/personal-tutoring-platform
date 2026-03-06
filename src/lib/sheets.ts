import { google } from "googleapis";

const SHEET_ID = process.env.GOOGLE_SHEET_ID!;

// Columnas en Google Sheet:
// A: email | B: name | C: credits | D: pack_purchased | E: expires_at | F: last_updated

async function getSheets() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function isExpired(expiresAt: string): boolean {
  if (!expiresAt) return false;
  return new Date() > new Date(expiresAt);
}

export async function getCredits(email: string): Promise<{ credits: number; name: string; expiresAt: string } | null> {
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: "Alumnos!A2:F",
  });

  const rows = res.data.values || [];
  const row = rows.find((r) => r[0]?.toLowerCase() === email.toLowerCase());
  if (!row) return null;

  const credits = parseInt(row[2] || "0", 10);
  const expiresAt = row[4] || "";

  // If pack is expired, treat as 0 credits
  if (expiresAt && isExpired(expiresAt)) {
    return { credits: 0, name: row[1] || "", expiresAt };
  }

  return { credits, name: row[1] || "", expiresAt };
}

export async function addOrUpdateStudent(
  email: string,
  name: string,
  creditsToAdd: number,
  packLabel: string
): Promise<void> {
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: "Alumnos!A2:F",
  });

  const rows = res.data.values || [];
  const rowIndex = rows.findIndex((r) => r[0]?.toLowerCase() === email.toLowerCase());

  const now = new Date();
  const expiresAt = addMonths(now, 6).toISOString(); // 6 months from now
  const nowStr = now.toISOString();

  if (rowIndex >= 0) {
    const currentCredits = parseInt(rows[rowIndex][2] || "0", 10);
    const currentExpires = rows[rowIndex][4] || "";

    // If existing pack is expired, reset credits; otherwise accumulate
    const baseCredits = currentExpires && isExpired(currentExpires) ? 0 : currentCredits;
    const newCredits = baseCredits + creditsToAdd;

    const sheetRow = rowIndex + 2;
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `Alumnos!A${sheetRow}:F${sheetRow}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[email, name, newCredits, packLabel, expiresAt, nowStr]],
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

export async function decrementCredit(email: string): Promise<{ ok: boolean; remaining: number }> {
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: "Alumnos!A2:F",
  });

  const rows = res.data.values || [];
  const rowIndex = rows.findIndex((r) => r[0]?.toLowerCase() === email.toLowerCase());
  if (rowIndex < 0) return { ok: false, remaining: 0 };

  const expiresAt = rows[rowIndex][4] || "";
  if (expiresAt && isExpired(expiresAt)) return { ok: false, remaining: 0 };

  const currentCredits = parseInt(rows[rowIndex][2] || "0", 10);
  if (currentCredits <= 0) return { ok: false, remaining: 0 };

  const newCredits = currentCredits - 1;
  const sheetRow = rowIndex + 2;

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `Alumnos!A${sheetRow}:F${sheetRow}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [[
        rows[rowIndex][0],
        rows[rowIndex][1],
        newCredits,
        rows[rowIndex][3],
        rows[rowIndex][4],
        new Date().toISOString(),
      ]],
    },
  });

  return { ok: true, remaining: newCredits };
}
