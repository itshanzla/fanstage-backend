import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { signToken, toUserResponse, type AuthUser } from "@/lib/auth";

export const runtime = "nodejs";

type RegisterBody = {
  name?: string;
  email?: string;
  password?: string;
  accountType?: "free" | "premium";
  accountStatus?: boolean;
  emailVerified?: boolean;
  profileComplete?: boolean;
};

export async function POST(req: Request) {
  const body = (await req.json()) as RegisterBody;

  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();
  const password = body.password;

  if (!name || !email || !password) {
    return NextResponse.json(
      { status: "error", message: "Name, email, and password are required." },
      { status: 400 }
    );
  }

  const accountType = body.accountType === "premium" ? "premium" : "free";
  const accountStatus =
    typeof body.accountStatus === "boolean" ? body.accountStatus : true;
  const emailVerified =
    typeof body.emailVerified === "boolean" ? body.emailVerified : false;
  const profileComplete =
    typeof body.profileComplete === "boolean" ? body.profileComplete : false;

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const result = await pool.query<AuthUser>(
      `INSERT INTO users
        (name, email, password_hash, role, account_type, account_status, email_verified, profile_complete)
       VALUES ($1, $2, $3, 'user', $4, $5, $6, $7)
       RETURNING id, name, email, role, account_type, account_status, email_verified, profile_complete`,
      [
        name,
        email,
        passwordHash,
        accountType,
        accountStatus,
        emailVerified,
        profileComplete,
      ]
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
      { status: "error", message: "Failed to register user." },
      { status: 500 }
    );
  }
}
