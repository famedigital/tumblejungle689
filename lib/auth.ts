import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db, sessionKey, verifySecret } from "@/lib/db";
import { can, homeFor, type Area, type Role } from "@/lib/types";

export type Session = {
  staffId: number;
  name: string;
  role: Role;
  exp: number;
};

const COOKIE = "tj_session";

function sign(payload: string): string {
  const mac = createHmac("sha256", sessionKey()).update(payload).digest("base64url");
  return `${payload}.${mac}`;
}

function readToken(token: string): Session | null {
  const split = token.lastIndexOf(".");
  if (split <= 0) return null;
  const payload = token.slice(0, split);
  const mac = token.slice(split + 1);
  const expected = createHmac("sha256", sessionKey()).update(payload).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString()) as Session;
    if (!session.exp || session.exp < Date.now()) return null;
    if (!session.role || !session.staffId) return null;
    return session;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  return readToken(token);
}

export async function setSession(session: Omit<Session, "exp">) {
  const full: Session = { ...session, exp: Date.now() + 14 * 60 * 60 * 1000 };
  const payload = Buffer.from(JSON.stringify(full)).toString("base64url");
  const jar = await cookies();
  jar.set(COOKIE, sign(payload), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 14 * 60 * 60,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export function findStaffBySecret(secret: string): {
  id: number;
  name: string;
  role: Role;
} | null {
  const rows = db()
    .prepare("SELECT id, name, role, secret_hash FROM staff WHERE active = 1")
    .all() as { id: number; name: string; role: Role; secret_hash: string }[];
  for (const row of rows) {
    if (verifySecret(secret.trim(), row.secret_hash)) {
      return { id: row.id, name: row.name, role: row.role };
    }
  }
  return null;
}

export async function requireArea(area: Area): Promise<Session> {
  const session = await getSession();
  if (!session || !can(session.role, area)) redirect("/login");
  return session;
}

export async function redirectHome() {
  const session = await getSession();
  if (session) redirect(homeFor(session.role));
}
