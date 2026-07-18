import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    ok: true,
    app: "CompanyNow",
    mode: "demo",
    timestamp: new Date().toISOString(),
  });
}
