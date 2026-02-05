import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { signToken, toUserResponse, type AuthUser } from "@/lib/auth";

export const runtime = "nodejs";

type RegisterAdminBody = {
  name?: string;
  email?: string;
  password?: string;
  securityCode?: string;
};

export async function POST(req: Request) {
  const body = (await req.json()) as RegisterAdminBody;

  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();
  const password = body.password;
  const securityCode = body.securityCode?.trim();

  if (!name || !email || !password || !securityCode) {
    return NextResponse.json(
      {
        status: "error",
        message: "Name, email, password, and security code are required.",
      },
      { status: 400 }
    );
  }

  if (securityCode !== process.env.ADMIN_SECURITY_CODE) {
    return NextResponse.json(
      { status: "error", message: "Invalid security code." },
      { status: 403 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const result = await pool.query<AuthUser>(
      `INSERT INTO users
        (name, email, password_hash, role, account_type, account_status, email_verified, profile_complete)
       VALUES ($1, $2, $3, 'admin', 'free', TRUE, FALSE, FALSE)
       RETURNING id, name, email, role, account_type, account_status, email_verified, profile_complete`,
      [name, email, passwordHash]
    );

    const user = result.rows[0];
    const token = signToken(user);

    return NextResponse.json(
      { status: "success", token, user: toUserResponse(user) },
      { status: 201 }
    );
  } catch (err) {
    const error = err as { code?: string };
    if (error.code === "23505") {
      return NextResponse.json(
        { status: "error", message: "Email already exists." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { status: "error", message: "Failed to register admin." },
      { status: 500 }
    );
  }
}
