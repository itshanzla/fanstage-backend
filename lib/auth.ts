import jwt from "jsonwebtoken";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  account_type: "free" | "premium";
  account_status: boolean;
  email_verified: boolean;
  profile_complete: boolean;
};

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }
  return secret;
}

export function signToken(user: Pick<AuthUser, "id" | "role" | "email">) {
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    getJwtSecret(),
    { expiresIn: "7d" }
  );
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
