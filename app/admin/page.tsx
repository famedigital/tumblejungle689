import {
  addStaffAction,
  saveVenueAction,
  setActiveAction,
  setSecretAction,
} from "@/app/actions";
import { ChargeForm } from "@/components/charge-form";
import { FloorBoard } from "@/components/floor-board";
import { Flash } from "@/components/flash";
import { StaffShell, type StaffSection } from "@/components/staff-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { requireArea } from "@/lib/auth";
import { floorPulse, getSettings, listStaff } from "@/lib/domain";

const SECTIONS = ["floor", "page", "charges", "staff"] as const;

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string; section?: string }>;
}) {
  const session = await requireArea("admin");
  const query = await searchParams;
  const section: StaffSection = SECTIONS.includes(query.section as (typeof SECTIONS)[number])
    ? (query.section as StaffSection)
    : "floor";
  const settings = section === "page" || section === "charges" ? await getSettings() : null;
  const pulse = section === "floor" ? await floorPulse() : null;
  const staff = section === "staff" ? await listStaff() : [];
  const panel = "space-y-4 rounded-3xl bg-card p-5 ring-1 ring-foreground/10";
  const title = section === "page" ? "Public page" : section === "charges" ? "Charges" : section === "staff" ? "Staff" : "Floor";

  return (
    <StaffShell role={session.role} name={session.name} title={title} tone="candy" current={section}>
      <Flash error={query.error} ok={query.ok} />
      {section === "floor" && pulse ? <FloorBoard pulse={pulse} /> : null}
      {section === "page" && settings ? (
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
      ) : null}
      {section === "charges" && settings ? (
        <section className={panel}>
          <h2 className="font-heading text-2xl">Service charge and GST</h2>
          <p className="text-sm text-muted-foreground">
            Turn each charge on or off, and set the percent. Off charges stay off the bill. GST uses the bill after service charge.
          </p>
          <ChargeForm scOn={settings.scOn} scPercent={settings.scPercent} gstOn={settings.gstOn} gstPercent={settings.gstPercent} />
        </section>
      ) : null}
      {section === "staff" ? (
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
      ) : null}
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
