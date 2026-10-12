import { headers } from "next/headers";

export async function requestOrigin(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export function visitPath(code: string): string {
  return `/t/${code}`;
}
