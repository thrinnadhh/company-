import { NextResponse } from "next/server";

export const dynamic = "force-static";

export function GET() {
  return NextResponse.json({
    ok: true,
    app: "CompanyNow",
    mode: "production-multi-user-pwa",
    timestamp: new Date().toISOString(),
  });
}
