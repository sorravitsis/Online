import { NextResponse } from "next/server";

export function success<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(
    {
      success: true,
      data
    },
    init
  );
}

export function failure(error: string, status = 400, init?: ResponseInit) {
  return NextResponse.json(
    {
      success: false,
      error
    },
    {
      status,
      ...init
    }
  );
}
