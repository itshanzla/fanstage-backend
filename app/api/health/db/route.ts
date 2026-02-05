import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET() {
  const result = await pool.query("SELECT 1 AS ok");
  const ok = result.rows[0]?.ok === 1;

  return NextResponse.json({ ok });
}
