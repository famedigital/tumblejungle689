import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Scanner } from "@/components/scanner";

export function Lookup({ to, label = "Type ticket code or phone" }: { to: string; label?: string }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <form action={to} className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1">
          <Label htmlFor="lookup-q">{label}</Label>
          <Input
            id="lookup-q"
            name="q"
            inputMode="text"
            autoComplete="off"
            placeholder="Type ticket code or phone"
            className="h-11 text-base"
          />
        </div>
        <Button type="submit" className="h-11 px-4">
          Find
        </Button>
      </form>
      <Scanner to={to} />
    </div>
  );
}
