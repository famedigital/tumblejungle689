import {
  addStaffAction,
  saveVenueAction,
  setActiveAction,
  setSecretAction,
} from "@/app/actions";
import { AdminTabs } from "@/components/admin-tabs";
import { FloorBoard } from "@/components/floor-board";
import { Flash } from "@/components/flash";
import { StaffShell } from "@/components/staff-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { requireArea } from "@/lib/auth";
import { floorPulse, getSettings, listStaff } from "@/lib/domain";
import Link from "next/link";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const session = await requireArea("admin");
  const query = await searchParams;
  const settings = await getSettings();
  const pulse = await floorPulse();
  const staff = await listStaff();
  const panel = "space-y-4 rounded-3xl bg-card p-5 ring-1 ring-foreground/10";

  return (
    <StaffShell role={session.role} name={session.name} title="Dashboard" tone="candy" current="/admin">
      <Flash error={query.error} ok={query.ok} />
      <AdminTabs
        tabs={[
          { id: "floor", label: "Floor", panel: <FloorBoard pulse={pulse} /> },
          {
            id: "page",
            label: "Page",
            panel: (
              <section className={panel}>
                <h2 className="font-heading text-2xl">Public page</h2>
                <form action={saveVenueAction} className="grid gap-3">
                  <Field name="venueName" label="Name" defaultValue={settings.venueName} />
                  <Field name="tagline" label="Tagline" defaultValue={settings.tagline} />
                  <Field name="address" label="Address" defaultValue={settings.address} />
                  <Field name="hours" label="Hours" defaultValue={settings.hours} placeholder="Leave blank until you set them" />
                  <Field name="phone" label="Phone" defaultValue={settings.phone} />
                  <Area name="about" label="About" defaultValue={settings.about} />
                  <Area name="playBlurb" label="Play page" defaultValue={settings.playBlurb} />
                  <Area name="eatBlurb" label="Cafe page" defaultValue={settings.eatBlurb} />
                  <Button type="submit" className="h-11 w-fit">
                    Save public page
                  </Button>
                </form>
              </section>
            ),
          },
          {
            id: "products",
            label: "Products",
            panel: (
              <section className={panel}>
                <h2 className="font-heading text-2xl">Product hub</h2>
                <p className="text-sm text-muted-foreground">
                  Play times, cafe dishes, and restaurant dishes are entered in Products. The counters and the public menu read that list.
                  {settings.ratesAreSamples || settings.menuIsSample
                    ? " Sample prices are still showing until you save the real ones."
                    : ""}
                </p>
                <Button asChild className="h-11 w-fit">
                  <Link href="/admin/products">Open product hub</Link>
                </Button>
              </section>
            ),
          },
          {
            id: "bank",
            label: "Bank",
            panel: (
              <section className={panel}>
                <h2 className="font-heading text-2xl">Bank details</h2>
                <p className="text-sm text-muted-foreground">
                  Upload the venue bank QR on the Bank page. Counters stamp the amount due onto it.
                </p>
                <Button asChild className="h-11 w-fit">
                  <Link href="/admin/bank">Edit bank details</Link>
                </Button>
              </section>
            ),
          },
          {
            id: "staff",
            label: "Staff",
            panel: (
              <section className={panel}>
                <h2 className="font-heading text-2xl">Staff</h2>
                <ul className="space-y-3">
                  {staff.map((person) => (
                    <li key={person.id} className="grid gap-2 rounded-2xl bg-[#fff3fb] p-3 sm:grid-cols-[1fr_auto]">
                      <div>
                        <p className="font-medium">
                          {person.name} · {person.role}
                        </p>
                        <p className="text-sm text-muted-foreground">{person.active ? "Active" : "Inactive"}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <form action={setSecretAction} autoComplete="off" className="flex gap-2">
                          <input type="hidden" name="id" value={person.id} />
                          <Input name="secret" type="text" autoComplete="off" spellCheck={false} placeholder="New PIN or password" className="till-secret h-11 w-44 bg-background" required minLength={4} />
                          <Button type="submit" variant="outline" className="h-11">
                            Update
                          </Button>
                        </form>
                        <form action={setActiveAction}>
                          <input type="hidden" name="id" value={person.id} />
                          <input type="hidden" name="active" value={person.active ? "0" : "1"} />
                          <Button type="submit" variant="ghost" className="h-11">
                            {person.active ? "Deactivate" : "Activate"}
                          </Button>
                        </form>
                      </div>
                    </li>
                  ))}
                </ul>
                <form action={addStaffAction} autoComplete="off" className="flex flex-wrap items-end gap-2">
                  <Field name="name" label="Name" />
                  <label className="space-y-1 text-sm">
                    <span>Role</span>
                    <select name="role" className="h-11 rounded-lg border bg-background px-2">
                      <option value="frontdesk">Front desk</option>
                      <option value="cafe">Cafe</option>
                      <option value="restaurant">Restaurant</option>
                      <option value="cashier">Cashier</option>
                      <option value="admin">Admin</option>
                    </select>
                  </label>
                  <Field name="secret" label="PIN or password" className="till-secret" />
                  <Button type="submit" className="h-11">
                    Add staff
                  </Button>
                </form>
              </section>
            ),
          },
        ]}
      />
    </StaffShell>
  );
}

function Field({
  name,
  label,
  defaultValue,
  placeholder,
  className,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label className="space-y-1 text-sm">
      <span>{label}</span>
      <Input name={name} type="text" autoComplete="off" defaultValue={defaultValue} placeholder={placeholder} className={`h-11 ${className ?? ""}`} />
    </label>
  );
}

function Area({ name, label, defaultValue }: { name: string; label: string; defaultValue?: string }) {
  return (
    <label className="space-y-1 text-sm">
      <span>{label}</span>
      <Textarea name={name} defaultValue={defaultValue} rows={3} />
    </label>
  );
}
