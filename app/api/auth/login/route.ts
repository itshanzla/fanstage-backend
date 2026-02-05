import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { signToken, toUserResponse, type AuthUser } from "@/lib/auth";

export const runtime = "nodejs";

type LoginBody = {
  email?: string;
  password?: string;
};

type AuthUserWithPassword = AuthUser & { password_hash: string };

export async function POST(req: Request) {
  const body = (await req.json()) as LoginBody;
  const email = body.email?.trim().toLowerCase();
  const password = body.password;

  if (!email || !password) {
    return NextResponse.json(
      { status: "error", message: "Email and password are required." },
      { status: 400 }
    );
  }

  const result = await pool.query<AuthUserWithPassword>(
    `SELECT id, name, email, role, account_type, account_status, email_verified, profile_complete, token_version, password_hash
     FROM users
     WHERE email = $1
     LIMIT 1`,
    [email]
  );

  const user = result.rows[0];
  if (!user) {
    return NextResponse.json(
      { status: "error", message: "Invalid credentials." },
      { status: 401 }
    );
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    return NextResponse.json(
      { status: "error", message: "Invalid credentials." },
      { status: 401 }
    );
  }

  const updated = await pool.query<AuthUser>(
    `UPDATE users
     SET token_version = token_version + 1
     WHERE id = $1
     RETURNING id, name, email, role, account_type, account_status, email_verified, profile_complete, token_version`,
    [user.id]
  );

  const freshUser = updated.rows[0];
  const token = signToken(freshUser);

  return NextResponse.json(
    { status: "success", token, user: toUserResponse(freshUser) },
    { status: 200 }
  );
}
