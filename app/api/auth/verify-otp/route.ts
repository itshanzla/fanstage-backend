import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

type OtpType = "email-verification" | "password-verification";

type VerifyOtpBody = {
  email?: string;
  otp?: string;
  type?: string;
};

function normalizeOtpType(value?: string): OtpType | null {
  if (!value) {
    return null;
  }

  if (value === "email-verification" || value === "email_verification") {
    return "email-verification";
  }

  if (value === "password-verification" || value === "password_verification") {
    return "password-verification";
  }

  return null;
}

export async function POST(req: Request) {
  const body = (await req.json()) as VerifyOtpBody;
  const email = body.email?.trim().toLowerCase();
  const otp = body.otp?.trim();
  const type = normalizeOtpType(body.type);

  if (!email || !otp || !type) {
    return NextResponse.json(
      { status: "error", message: "Email, otp, and type are required." },
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
    [email, type]
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

  if (type === "email-verification") {
    await pool.query(
      "UPDATE users SET email_verified = TRUE WHERE email = $1",
      [email]
    );
  }

  return NextResponse.json(
    { status: "success", message: "OTP verified." },
    { status: 200 }
  );
}
