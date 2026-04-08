import { NextResponse } from "next/server";
import { buildLazadaAuthorizeUrl, signLazadaConnectState } from "@/lib/lazada";

export const dynamic = "force-dynamic";

export async function GET() {
  const state = await signLazadaConnectState("/admin");
  return NextResponse.redirect(buildLazadaAuthorizeUrl(state));
}
