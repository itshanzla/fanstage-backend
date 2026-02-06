import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { jwtVerify, createRemoteJWKSet } from "jose";
import { pool } from "@/lib/db";
import { signToken, toUserResponse, type AuthUser } from "@/lib/auth";

export const runtime = "nodejs";

type Provider = "google" | "apple";

type SocialBody = {
  provider?: Provider;
  idToken?: string;
};

const googleJwks = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs")
);

const appleJwks = createRemoteJWKSet(
  new URL("https://appleid.apple.com/auth/keys")
);

async function verifyGoogleToken(idToken: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID is not set");
  }

  const { payload } = await jwtVerify(idToken, googleJwks, {
    audience: clientId,
    issuer: ["https://accounts.google.com", "accounts.google.com"],
  });

  return payload;
}

async function verifyAppleToken(idToken: string) {
  const clientId = process.env.APPLE_CLIENT_ID;
  if (!clientId) {
    throw new Error("APPLE_CLIENT_ID is not set");
  }

  const { payload } = await jwtVerify(idToken, appleJwks, {
    audience: clientId,
    issuer: "https://appleid.apple.com",
  });

  return payload;
}

function getNameFromPayload(payload: Record<string, unknown>) {
  const name = typeof payload.name === "string" ? payload.name : "";
  if (name) {
    return name;
  }

  const givenName =
    typeof payload.given_name === "string" ? payload.given_name : "";
  const familyName =
    typeof payload.family_name === "string" ? payload.family_name : "";
  const combined = `${givenName} ${familyName}`.trim();
  if (combined) {
    return combined;
  }

  return "User";
}

export async function POST(req: Request) {
  const body = (await req.json()) as SocialBody;
  const provider = body.provider;
  const idToken = body.idToken;

  if (!provider || !idToken) {
    return NextResponse.json(
      { status: "error", message: "provider and idToken are required." },
      { status: 400 }
    );
  }

  if (provider !== "google" && provider !== "apple") {
    return NextResponse.json(
      { status: "error", message: "Invalid provider." },
      { status: 400 }
    );
  }

  try {
    const payload =
      provider === "google"
        ? await verifyGoogleToken(idToken)
        : await verifyAppleToken(idToken);

    const email =
      typeof payload.email === "string"
        ? payload.email.trim().toLowerCase()
        : "";

    if (!email) {
      return NextResponse.json(
        { status: "error", message: "Email not available in token." },
        { status: 400 }
      );
    }

    const existing = await pool.query<AuthUser>(
      `SELECT id, name, email, role, account_type, account_status, email_verified, profile_complete, token_version
       FROM users
       WHERE email = $1
       LIMIT 1`,
      [email]
    );

    if (existing.rows[0]) {
      const updated = await pool.query<AuthUser>(
        `UPDATE users
         SET token_version = token_version + 1,
             email_verified = TRUE
         WHERE email = $1
         RETURNING id, name, email, role, account_type, account_status, email_verified, profile_complete, token_version`,
        [email]
      );

      const user = updated.rows[0];
      const token = signToken(user);

      return NextResponse.json(
        { status: "success", token, user: toUserResponse(user) },
        { status: 200 }
      );
    }

    const name = getNameFromPayload(payload as Record<string, unknown>);
    const randomPassword = randomBytes(32).toString("hex");
    const passwordHash = await bcrypt.hash(randomPassword, 10);

    const inserted = await pool.query<AuthUser>(
      `INSERT INTO users
        (name, email, password_hash, role, account_type, account_status, email_verified, profile_complete)
       VALUES ($1, $2, $3, 'user', 'free', TRUE, TRUE, FALSE)
       RETURNING id, name, email, role, account_type, account_status, email_verified, profile_complete, token_version`,
      [name, email, passwordHash]
    );

    const user = inserted.rows[0];
    const token = signToken(user);

    return NextResponse.json(
      { status: "success", token, user: toUserResponse(user) },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: "Social login failed." },
      { status: 401 }
    );
  }
}
