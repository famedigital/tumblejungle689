export function Flash({ error, ok }: { error?: string; ok?: string }) {
  if (!error && !ok) return null;
  return (
    <p
      role="alert"
      className={
        error
          ? "rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          : "rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-primary"
      }
    >
      {error || ok}
    </p>
  );
}
