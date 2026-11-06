import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  addStaff,
  listStaff,
  setStaffActive,
  setStaffName,
  setStaffRole,
  setStaffSecret,
} from "@/lib/domain";
import type { Role } from "@/lib/types";

const ROLES: Role[] = ["admin", "frontdesk", "cafe", "restaurant", "cashier"];

function asRole(value: unknown): Role | null {
  const role = String(value || "");
  return ROLES.includes(role as Role) ? (role as Role) : null;
}

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return null;
  }
  return session;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Admin only." }, { status: 401 });
  }
  const staff = await listStaff();
  return NextResponse.json({ ok: true, staff });
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Admin only." }, { status: 401 });
  }
  try {
    const body = (await request.json()) as {
      action?: string;
      id?: number;
      name?: string;
      role?: string;
      secret?: string;
      active?: boolean;
    };
    const action = String(body.action || "");
    const id = Number(body.id);

    if (action === "add") {
      const role = asRole(body.role) || "cashier";
      await addStaff(String(body.name || ""), role, String(body.secret || ""));
    } else if (action === "name") {
      if (!Number.isFinite(id) || id < 1) throw new Error("Staff id required.");
      await setStaffName(id, String(body.name || ""));
    } else if (action === "pin") {
      if (!Number.isFinite(id) || id < 1) throw new Error("Staff id required.");
      await setStaffSecret(id, String(body.secret || ""));
    } else if (action === "role") {
      if (!Number.isFinite(id) || id < 1) throw new Error("Staff id required.");
      const role = asRole(body.role);
      if (!role) throw new Error("Choose a valid role.");
      await setStaffRole(id, role);
    } else if (action === "active") {
      if (!Number.isFinite(id) || id < 1) throw new Error("Staff id required.");
      await setStaffActive(id, Boolean(body.active));
    } else {
      throw new Error("Unknown staff action.");
    }

    const staff = await listStaff();
    return NextResponse.json({ ok: true, staff });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Staff update failed." },
      { status: 400 },
    );
  }
}
