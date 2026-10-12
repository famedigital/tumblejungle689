import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-3 px-4">
      <h1 className="font-heading text-4xl">Not found</h1>
      <p className="text-sm text-muted-foreground">That page or ticket is not on this computer.</p>
      <Link href="/" className="text-sm font-medium text-primary">
        Back to Tumble Jungle
      </Link>
    </main>
  );
}
