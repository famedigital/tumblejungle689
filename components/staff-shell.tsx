import Link from "next/link";
import { logoutAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { can, type Role } from "@/lib/types";

const LINKS: { href: string; label: string; area: "desk" | "cafe" | "restaurant" | "cashier" | "admin" }[] = [
  { href: "/desk", label: "Front desk", area: "desk" },
  { href: "/counter/cafe", label: "Cafe", area: "cafe" },
  { href: "/counter/restaurant", label: "Restaurant", area: "restaurant" },
  { href: "/cashier", label: "Cashier", area: "cashier" },
  { href: "/admin/products", label: "Products", area: "admin" },
  { href: "/admin/bank", label: "Bank", area: "admin" },
  { href: "/admin/receipt", label: "Receipt", area: "admin" },
  { href: "/admin", label: "Admin", area: "admin" },
];

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
  const candy = tone === "candy";
  return (
    <div className={candy ? "candy min-h-full" : "min-h-full bg-background"}>
      <header className="no-print sticky top-0 z-10 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <Link href="/" className="font-heading text-lg text-primary">
            Tumble Jungle
          </Link>
          <nav className="flex flex-wrap gap-1">
            {LINKS.filter((link) => can(role, link.area)).map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={
                  current === link.href
                    ? "rounded-full bg-primary px-3 py-1.5 text-sm text-primary-foreground"
                    : "rounded-full px-3 py-1.5 text-sm hover:bg-accent"
                }
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">
              {name} · {role}
            </span>
            <form action={logoutAction}>
              <Button type="submit" variant="ghost" className="h-9">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <h1 className="font-heading text-4xl">{title}</h1>
        {children}
      </main>
    </div>
  );
}
