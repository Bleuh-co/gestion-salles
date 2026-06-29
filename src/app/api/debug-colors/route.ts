import { NextResponse } from "next/server";
import { readFamilleColors } from "@/lib/sheets-sync";
import { FAMILLE_COLORS_FALLBACK } from "@/lib/types";

export const runtime = "nodejs";

/**
 * Temporary debug endpoint — shows what readFamilleColors() returns
 * vs the fallback. Delete after verifying colors work.
 */
export async function GET() {
  try {
    const sheetColors = await readFamilleColors();
    const merged = { ...FAMILLE_COLORS_FALLBACK, ...sheetColors };
    return NextResponse.json({
      status: "ok",
      sheetColors,
      fallbackColors: FAMILLE_COLORS_FALLBACK,
      mergedColors: merged,
      sheetColorCount: Object.keys(sheetColors).length,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({
      status: "error",
      error: message,
      fallbackColors: FAMILLE_COLORS_FALLBACK,
    }, { status: 500 });
  }
}
