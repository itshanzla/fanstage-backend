import { NextResponse } from "next/server";
import { requireAuth, toUserResponse } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return NextResponse.json(
      { status: "error", message: auth.message },
      { status: auth.status }
    );
  }

  return NextResponse.json(
    { status: "success", user: toUserResponse(auth.user) },
    { status: 200 }
  );
}
