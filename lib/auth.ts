import { SignJWT, jwtVerify } from "jose";
import type { JWTPayload } from "jose";
import type { NextRequest } from "next/server";
import { env } from "@/lib/env";

const encoder = new TextEncoder();

export type SessionPayload = JWTPayload & {
  sub: string;
};

function getSecret() {
  return encoder.encode(env.auth.secret());
}

export async function signSessionToken(subject: string) {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(subject)
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(getSecret());
}

export async function verifySessionToken(token: string) {
  const verified = await jwtVerify(token, getSecret());
  return verified.payload as SessionPayload;
}

export async function getRequestSession(request: NextRequest) {
  const token = request.cookies.get(env.auth.cookieName)?.value;

  if (!token) {
    return null;
  }

  try {
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}
