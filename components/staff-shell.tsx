"use client";

import { useState } from "react";
import Link from "next/link";
import { logoutAction } from "@/app/actions";
import { PlaytabCredit, PlaytabMark } from "@/components/playtab-mark";
import { Button } from "@/components/ui/button";
import { can, type Role } from "@/lib/types";

export type StaffSection = "cashier" | "floor" | "page" | "charges" | "products" | "bank" | "receipt" | "staff";

const LINKS: { id: StaffSection; href: string; label: string }[] = [
  { id: "cashier", href: "/cashier", label: "Cashier" },
  { id: "floor", href: "/admin", label: "Floor" },
  { id: "page", href: "/admin?section=page", label: "Page" },
  { id: "charges", href: "/admin?section=charges", label: "Charges" },
  { id: "products", href: "/admin/products", label: "Products" },
  { id: "bank", href: "/admin/bank", label: "Bank" },
  { id: "receipt", href: "/admin/receipt", label: "Receipt" },
  { id: "staff", href: "/admin?section=staff", label: "Staff" },
];

function allowed(role: Role, id: StaffSection) {
  if (id === "cashier") return can(role, "cashier");
  return can(role, "admin");
}

export function StaffShell({
  role,
  name,
  title,
  tone = "desk",
  current,
  children,
}: {
  role: Role;
  name: string;
  title: string;
  tone?: "desk" | "candy";
  current?: string;
  children: React.ReactNode;
}) {
  const [more, setMore] = useState(false);
  const links = LINKS.filter((link) => allowed(role, link.id));
  const moreLinks = ["page", "charges", "bank", "receipt", "staff", "cashier"]
    .map((id) => links.find((link) => link.id === id))
    .filter((link) => link != null);
  const candy = tone === "candy";
  const moreCurrent = moreLinks.some((link) => link.id === current);

  return (
    <div className={candy ? "candy min-h-dvh lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)]" : "min-h-dvh bg-background lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)]"}>
      <aside className="hidden border-r bg-card lg:flex lg:min-h-dvh lg:flex-col">
        <Link href="/admin" className="inline-flex items-center gap-2 px-4 py-5 font-heading text-lg text-primary">
          <PlaytabMark size={32} />
          Tumble Jungle
        </Link>
        <nav className="grid gap-1 px-3" aria-label="Office">
          {links.map((link) => (
            <Link
              key={link.id}
              href={link.href}
              aria-current={current === link.id ? "page" : undefined}
              className={
                current === link.id
                  ? "flex h-11 items-center rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground"
                  : "flex h-11 items-center rounded-xl px-3 text-sm font-medium hover:bg-accent"
              }
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto grid gap-3 px-4 py-4">
          <p className="text-sm text-muted-foreground">
            {name} · {role}
          </p>
          <form action={logoutAction}>
            <Button type="submit" variant="outline" className="h-11 w-full">
              Sign out
            </Button>
          </form>
        </div>
      </aside>
      <div className="flex min-h-dvh flex-col">
        <header className="no-print sticky top-0 z-20 flex items-center justify-between gap-3 border-b bg-card/95 px-4 py-3 backdrop-blur lg:hidden">
          <Link href="/admin" className="inline-flex items-center gap-2 font-heading text-lg text-primary">
            <PlaytabMark size={28} />
            Tumble Jungle
          </Link>
          <form action={logoutAction}>
            <Button type="submit" variant="ghost" className="h-11">
              Sign out
            </Button>
          </form>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-6 pb-24 lg:pb-6">
          <h1 className="font-heading text-4xl">{title}</h1>
          {children}
          <PlaytabCredit className="text-muted-foreground" />
        </main>
        <nav className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t bg-card pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Office">
          <Link href="/admin" aria-current={current === "floor" ? "page" : undefined} className={thumbClass(current === "floor")}>
            Floor
          </Link>
          <Link href="/admin/products" aria-current={current === "products" ? "page" : undefined} className={thumbClass(current === "products")}>
            Products
          </Link>
          <button type="button" aria-pressed={more || moreCurrent} className={thumbClass(more || moreCurrent)} onClick={() => setMore((open) => !open)}>
            More
          </button>
        </nav>
        {more ? (
          <div className="fixed inset-0 z-20 bg-foreground/40 lg:hidden" role="presentation" onClick={() => setMore(false)}>
            <div
              className="absolute inset-x-0 bottom-16 rounded-t-3xl bg-card p-4 shadow-lg"
              role="dialog"
              aria-label="More"
              onClick={(event) => event.stopPropagation()}
            >
              <p className="font-heading text-2xl">More</p>
              <div className="mt-3 grid gap-2">
                {moreLinks.map((link) => (
                  <Link
                    key={link.id}
                    href={link.href}
                    aria-current={current === link.id ? "page" : undefined}
                    onClick={() => setMore(false)}
                    className={
                      current === link.id
                        ? "flex h-12 items-center rounded-2xl bg-primary px-4 text-sm font-medium text-primary-foreground"
                        : "flex h-12 items-center rounded-2xl bg-muted px-4 text-sm font-medium"
                    }
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function thumbClass(on: boolean) {
  return on
    ? "flex h-14 items-center justify-center text-sm font-semibold text-primary"
    : "flex h-14 items-center justify-center text-sm font-semibold text-muted-foreground";
}
