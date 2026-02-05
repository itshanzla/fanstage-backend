import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { mailer, mailFrom } from "@/lib/email";

export const runtime = "nodejs";

type OtpType = "email-verification" | "password-verification";

type SendOtpBody = {
  email?: string;
  type?: OtpType;
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

function getExpiryMinutes() {
  const raw = process.env.OTP_EXPIRES_IN_MINUTES;
  const parsed = raw ? Number(raw) : 2;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 2;
}

export async function POST(req: Request) {
  const body = (await req.json()) as SendOtpBody;
  const email = body.email?.trim().toLowerCase();
  const type = normalizeOtpType(body.type);

  if (!email || !type) {
    return NextResponse.json(
      { status: "error", message: "Email and type are required." },
      { status: 400 }
    );
  }

  if (!type) {
    return NextResponse.json(
      { status: "error", message: "Invalid OTP type." },
      { status: 400 }
    );
  }

  const existing = await pool.query("SELECT 1 FROM users WHERE email = $1", [
    email,
  ]);
  if (existing.rowCount === 0) {
    return NextResponse.json(
      { status: "error", message: "Email not found." },
      { status: 404 }
    );
  }

  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  const codeHash = await bcrypt.hash(otp, 10);
  const expiresInMinutes = getExpiryMinutes();
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

  await pool.query("DELETE FROM otp_codes WHERE email = $1 AND type = $2", [
    email,
    type,
  ]);

  await pool.query(
    `INSERT INTO otp_codes (email, type, code_hash, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [email, type, codeHash, expiresAt]
  );

  const subject =
    type === "email-verification"
      ? "Your email verification code"
      : "Your password reset code";

  const text = `Your OTP code is ${otp}. It expires in ${expiresInMinutes} minutes.`;

  await mailer.sendMail({
    from: mailFrom,
    to: email,
    subject,
    text,
  });

  return NextResponse.json(
    { status: "success", message: "OTP sent.", expiresInMinutes },
    { status: 200 }
  );
}
