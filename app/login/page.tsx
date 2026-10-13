import { loginAction } from "@/app/actions";
import { Flash } from "@/components/flash";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { redirectHome } from "@/lib/auth";
import { getSettings } from "@/lib/domain";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await redirectHome();
  const { error } = await searchParams;
  const settings = await getSettings();
  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center gap-6 px-4 py-16">
      <div>
        <p className="text-sm uppercase tracking-[0.16em] text-primary">Staff</p>
        <h1 className="font-heading text-4xl">{settings.venueName}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sign in on this computer. Nothing is sent to a cloud account.</p>
      </div>
      <Flash error={error} />
      <form action={loginAction} className="space-y-4 rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
        <div className="space-y-1">
          <Label htmlFor="secret">Password or PIN</Label>
          <Input id="secret" name="secret" type="password" autoComplete="current-password" required className="h-12 text-lg" />
        </div>
        <Button type="submit" className="h-11 w-full">
          Sign in
        </Button>
      </form>
    </main>
  );
}
