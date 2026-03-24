"use server";

import { getFilteredStoreSummariesForExport, type PeriodKey } from "@/app/actions/sales";
import {
  createSheetsClient,
  getSheetTabName,
  getSpreadsheetId,
  isGoogleSheetsExportConfigured,
} from "@/lib/googleSheetsClient";
import { buildSheetAppendValues } from "@/lib/sheetExportFormat";

export async function getGoogleSheetsExportStatus(): Promise<{
  configured: boolean;
}> {
  return { configured: isGoogleSheetsExportConfigured() };
}

/**
 * 현재 대시보드와 동일 필터(기간·시/도·지점 검색)로 시트 하단에 행 추가.
 * 서비스 계정 이메일을 스프레드시트에 편집자로 공유해야 합니다.
 */
export async function appendFilteredSalesToGoogleSheet(params: {
  period: PeriodKey;
  sidoFilter?: string;
  searchQuery?: string;
  /** false면 헤더 없이 데이터 행만 추가 */
  includeHeader?: boolean;
}): Promise<{
  appendedRows: number;
  dataRows: number;
  includeHeader: boolean;
}> {
  if (!isGoogleSheetsExportConfigured()) {
    throw new Error(
      "Sheets 보내기가 설정되지 않았습니다. .env.local에 GOOGLE_SHEETS_SPREADSHEET_ID와 서비스 계정 JSON(또는 BASE64)을 넣고, 해당 이메일을 스프레드시트에 초대하세요.",
    );
  }

  const summaries = await getFilteredStoreSummariesForExport({
    period: params.period,
    sidoFilter: params.sidoFilter,
    searchQuery: params.searchQuery,
  });

  if (summaries.length === 0) {
    throw new Error("보낼 데이터가 없습니다. 필터를 조정해 보세요.");
  }

  const exportedAt = new Date();
  const values = buildSheetAppendValues(summaries, params.period, {
    includeHeader: params.includeHeader !== false,
    exportedAt,
  });

  const sheets = createSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const tab = getSheetTabName();
  const range = `${tab}!A:Z`;

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values },
  });

  const includeHeader = params.includeHeader !== false;
  return {
    appendedRows: values.length,
    dataRows: summaries.length,
    includeHeader,
  };
}
