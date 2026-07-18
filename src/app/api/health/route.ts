import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    ok: true,
    app: "CompanyNow",
    mode: "live-two-user-mvp",
    timestamp: new Date().toISOString(),
  });
}
