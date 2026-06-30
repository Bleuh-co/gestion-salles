import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

const PLANS_COLLECTION = "plans";

interface Props {
  params: Promise<{ planId: string }>;
}

/**
 * POST /api/plan/[planId]/room-positions
 * Save room positions for a plan (admin only).
 * Body: { room_positions: { [roomId]: { x: number, y: number } } }
 */
export async function POST(req: NextRequest, { params }: Props) {
  try {
    const session = await requireAdmin();
    const { planId } = await params;
    const body = await req.json();
    const { room_positions } = body;

    if (!room_positions || typeof room_positions !== "object") {
      return NextResponse.json({ error: "room_positions (objet) requis" }, { status: 400 });
    }

    // Sanitize positions
    const sanitized: Record<string, { x: number; y: number }> = {};
    for (const [roomId, pos] of Object.entries(room_positions)) {
      if (!pos || typeof pos !== "object") continue;
      const p = pos as { x?: number; y?: number };
      const x = Number(p.x);
      const y = Number(p.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      sanitized[roomId] = {
        x: Math.max(0, Math.min(1, x)),
        y: Math.max(0, Math.min(1, y)),
      };
    }

    const db = adminDb();
    // IMPORTANT: use update() instead of set({merge:true}).
    // merge:true deep-merges nested objects, so deleted room keys
    // are never removed. update() replaces the entire field value.
    await db.collection(PLANS_COLLECTION).doc(planId).update({
      room_positions: sanitized,
      room_positions_updated_at: FieldValue.serverTimestamp(),
      room_positions_updated_by: session.email,
    });

    return NextResponse.json({
      status: "success",
      plan_id: planId,
      count: Object.keys(sanitized).length,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "UNAUTHORIZED" || message === "FORBIDDEN") {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
