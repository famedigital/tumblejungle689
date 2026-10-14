import { notFound, redirect } from "next/navigation";
import { StickerSheet } from "@/components/sticker-sheet";
import { getSession } from "@/lib/auth";
import { getSettings, getVisitByCode } from "@/lib/domain";
import { requestOrigin, visitPath } from "@/lib/origin";
import { qrDataUrl } from "@/lib/qr";
import { can } from "@/lib/types";

export default async function StickersPage({ params }: { params: Promise<{ code: string }> }) {
  const session = await getSession();
  if (!session || (!can(session.role, "cashier") && !can(session.role, "desk"))) redirect("/login");
  const { code } = await params;
  const visit = await getVisitByCode(code);
  if (!visit) notFound();
  const settings = await getSettings();
  const origin = await requestOrigin();
  const qr = await qrDataUrl(`${origin}${visitPath(visit.code)}`);
  const back = can(session.role, "cashier") ? `/cashier?q=${visit.code}` : `/desk?q=${visit.code}`;

  return (
    <StickerSheet
      venue={settings.venueName}
      code={visit.code}
      phone={visit.phone}
      qr={qr}
      children={visit.childCount}
      started={visit.createdAt}
      ends={visit.paidUntil}
      back={back}
    />
  );
}
