const SENT_KEY = "tumble-wa";
const SENT_EVENT = "tumble-wa-event";

export function playTimeUpText(venue: string, minutesOver: number): string {
  const over = Math.max(0, Math.round(minutesOver));
  if (over <= 10) {
    return `Play time at ${venue} is up. You have 10 minutes to top up or collect your children. To top up, come to the counter and reload, or pay at checkout.`;
  }
  const minutes = `${over} minute${over === 1 ? "" : "s"}`;
  return `Play time at ${venue} ended ${minutes} ago. Please come to the counter to top up or collect your children. You can also pay at checkout.`;
}

export function whatsAppChat(phone: string, venue: string, minutesOver: number): string {
  const digits = phone.replace(/\D/g, "").slice(-8);
  return `https://wa.me/975${digits}?text=${encodeURIComponent(playTimeUpText(venue, minutesOver))}`;
}

export function emptySentSnapshot() {
  return "";
}

export function readSentSnapshot(): string {
  if (typeof sessionStorage === "undefined") return "";
  try {
    return sessionStorage.getItem(SENT_KEY) ?? "";
  } catch {
    return "";
  }
}

export function subscribeSent(onChange: () => void) {
  window.addEventListener(SENT_EVENT, onChange);
  return () => window.removeEventListener(SENT_EVENT, onChange);
}

export function sentIdsFrom(snapshot: string): number[] {
  return snapshot
    .split(",")
    .filter(Boolean)
    .map(Number)
    .filter((id) => Number.isFinite(id));
}

export function rememberChat(id: number) {
  try {
    const ids = new Set(sentIdsFrom(readSentSnapshot()));
    ids.add(id);
    sessionStorage.setItem(SENT_KEY, [...ids].join(","));
    window.dispatchEvent(new Event(SENT_EVENT));
  } catch {
    /* the link still opens */
  }
}
