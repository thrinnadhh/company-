import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    ok: true,
    app: "CompanyNow",
    mode: "production-two-user-pwa",
    timestamp: new Date().toISOString(),
  });
}
