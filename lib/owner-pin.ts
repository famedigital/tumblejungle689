"use client";

export async function checkOwnerPin(secret: string): Promise<string> {
  const pin = secret.trim();
  if (!pin) return "Enter the owner PIN.";
  try {
    const response = await fetch("/api/till/pin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret: pin }),
    });
    const body = (await response.json()) as { ok?: boolean; error?: string };
    if (!response.ok || !body.ok) return body.error || "Owner PIN was not recognised.";
    return "";
  } catch {
    return "Could not check the owner PIN.";
  }
}
