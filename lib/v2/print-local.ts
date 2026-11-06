/** Desktop / counter till should open the system print dialog. */
export function forceLocalPrintDialog(): boolean {
  if (typeof window === "undefined") return false;
  // Prefer browser dialog on this device for admit / KOT / settle.
  // Cloud agent still receives the queued job from the API for remote printers.
  return true;
}
