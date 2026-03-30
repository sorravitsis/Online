declare module "jose" {
  export interface JWTPayload {
    sub?: string;
    exp?: number;
    [key: string]: unknown;
  }

  export class SignJWT {
    constructor(payload: Record<string, unknown>);
    setProtectedHeader(header: Record<string, string>): this;
    setSubject(subject: string): this;
    setIssuedAt(): this;
    setExpirationTime(value: string | number | Date): this;
    sign(secret: Uint8Array): Promise<string>;
  }

  export function jwtVerify(
    token: string,
    secret: Uint8Array
  ): Promise<{
    payload: JWTPayload;
  }>;
}
