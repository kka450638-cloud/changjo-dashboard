import { google } from "googleapis";

function parseServiceAccountCredentials(): Record<string, unknown> {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64?.trim();
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  let jsonStr: string | undefined;
  if (b64) {
    try {
      jsonStr = Buffer.from(b64, "base64").toString("utf8");
    } catch {
      throw new Error(
        "Sheets: GOOGLE_SERVICE_ACCOUNT_JSON_BASE64를 디코딩할 수 없습니다.",
      );
    }
  } else if (raw) {
    jsonStr = raw;
  } else {
    throw new Error(
      "Sheets: GOOGLE_SERVICE_ACCOUNT_JSON 또는 GOOGLE_SERVICE_ACCOUNT_JSON_BASE64를 설정하세요.",
    );
  }
  try {
    return JSON.parse(jsonStr) as Record<string, unknown>;
  } catch {
    throw new Error("Sheets: 서비스 계정 JSON 파싱에 실패했습니다.");
  }
}

export function getSpreadsheetId(): string {
  const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();
  if (!id) {
    throw new Error("Sheets: GOOGLE_SHEETS_SPREADSHEET_ID를 설정하세요.");
  }
  return id;
}

export function getSheetTabName(): string {
  return process.env.GOOGLE_SHEETS_TAB?.trim() || "Sheet1";
}

export function createSheetsClient() {
  const credentials = parseServiceAccountCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

export function isGoogleSheetsExportConfigured(): boolean {
  const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64?.trim();
  return Boolean(id && (json || b64));
}
