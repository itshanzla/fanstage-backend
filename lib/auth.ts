import jwt from "jsonwebtoken";
import { pool } from "@/lib/db";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  account_type: "free" | "premium";
  account_status: boolean;
  email_verified: boolean;
  profile_complete: boolean;
  token_version: number;
};

type JwtPayload = {
  sub: string;
  role: "user" | "admin";
  email: string;
  tokenVersion: number;
  iat?: number;
  exp?: number;
};

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }
  return secret;
}

export function signToken(
  user: Pick<AuthUser, "id" | "role" | "email" | "token_version">
) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      email: user.email,
      tokenVersion: user.token_version,
    },
    getJwtSecret(),
    { expiresIn: "7d" }
  );
}

export function verifyToken(token: string) {
  return jwt.verify(token, getJwtSecret()) as JwtPayload;
}

export async function getUserFromToken(token: string) {
  const payload = verifyToken(token);
  const result = await pool.query<AuthUser>(
    `SELECT id, name, email, role, account_type, account_status, email_verified, profile_complete, token_version
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [payload.sub]
  );

  const user = result.rows[0];
  if (!user || user.token_version !== payload.tokenVersion) {
    return null;
  }

  return user;
}

export async function requireAuth(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";

  if (!token) {
    return { ok: false as const, status: 401, message: "Missing token." };
  }

  try {
    const user = await getUserFromToken(token);
    if (!user) {
      return { ok: false as const, status: 401, message: "Invalid token." };
    }

    return { ok: true as const, user };
  } catch {
    return { ok: false as const, status: 401, message: "Invalid token." };
  }
}

export function toUserResponse(user: AuthUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    accountType: user.account_type,
    accountStatus: user.account_status,
    emailVerified: user.email_verified,
    profileComplete: user.profile_complete,
  };
}
