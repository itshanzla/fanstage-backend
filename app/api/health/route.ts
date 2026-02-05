import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const result = await pool.query("SELECT 1 AS ok");
    const dbOk = result.rows[0]?.ok === 1;
    const ok = dbOk;

    return NextResponse.json({
      ok,
      status: ok ? "ok" : "error",
      db: dbOk ? "ok" : "error",
    });
  } catch {
    return NextResponse.json({ ok: false, status: "error", db: "error" });
  }
}
