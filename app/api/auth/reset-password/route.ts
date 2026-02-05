import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

type ResetBody = {
  email?: string;
  otp?: string;
  type?: string;
  newPassword?: string;
};

function normalizeOtpType(value?: string) {
  if (!value) {
    return null;
  }
  if (value === "password-verification" || value === "password_verification") {
    return "password-verification";
  }
  return null;
}

export async function POST(req: Request) {
  const body = (await req.json()) as ResetBody;
  const email = body.email?.trim().toLowerCase();
  const otp = body.otp?.trim();
  const type = normalizeOtpType(body.type) ?? "password-verification";
  const newPassword = body.newPassword;
  if (!email || !otp || !newPassword) {
    return NextResponse.json(
      {
        status: "error",
        message: "Email, otp, and newPassword are required.",
      },
      { status: 400 }
    );
  }

  if (!type) {
    return NextResponse.json(
      { status: "error", message: "Invalid OTP type." },
      { status: 400 }
    );
  }

  const result = await pool.query<{
    id: string;
    code_hash: string;
    expires_at: Date;
  }>(
    `SELECT id, code_hash, expires_at
     FROM otp_codes
     WHERE email = $1 AND type = $2
     ORDER BY created_at DESC
     LIMIT 1`,
    [email, "password-verification"]
  );

  const row = result.rows[0];
  if (!row) {
    return NextResponse.json(
      { status: "error", message: "Invalid or expired OTP." },
      { status: 400 }
    );
  }

  if (row.expires_at.getTime() < Date.now()) {
    await pool.query("DELETE FROM otp_codes WHERE id = $1", [row.id]);
    return NextResponse.json(
      { status: "error", message: "Invalid or expired OTP." },
      { status: 400 }
    );
  }

  const match = await bcrypt.compare(otp, row.code_hash);
  if (!match) {
    return NextResponse.json(
      { status: "error", message: "Invalid or expired OTP." },
      { status: 400 }
    );
  }

  await pool.query("DELETE FROM otp_codes WHERE id = $1", [row.id]);

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await pool.query(
    `UPDATE users
     SET password_hash = $1,
         token_version = token_version + 1,
         updated_at = NOW()
     WHERE email = $2`,
    [passwordHash, email]
  );

  return NextResponse.json(
    { status: "success", message: "Password updated." },
    { status: 200 }
  );
}
