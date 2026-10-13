import { notFound } from "next/navigation";
import { PassCard } from "@/components/pass-card";
import { getSettings, getVisitByCode } from "@/lib/domain";
import { formatNu, formatPhone, formatWhen, minutesLeft } from "@/lib/format";
import { overtimeSentence } from "@/lib/overtime";
import { requestOrigin, visitPath } from "@/lib/origin";
import { qrDataUrl } from "@/lib/qr";
import Link from "next/link";

export default async function TicketPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const visit = await getVisitByCode(code);
  if (!visit) notFound();
  const settings = await getSettings();
  const origin = await requestOrigin();
  const url = `${origin}${visitPath(visit.code)}`;
  const qr = await qrDataUrl(url);
  const left = minutesLeft(visit.paidUntil);

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col gap-5 px-4 py-8">
      <Link href="/" className="font-heading text-2xl text-primary">
        {settings.venueName}
      </Link>
      <PassCard visit={visit} venueName={settings.venueName} qr={qr} ticketUrl={url} />
      <section className="no-print space-y-2 text-sm">
        <p>
          {visit.status === "settled"
            ? "This visit is closed."
            : left >= 0
              ? `Play is paid until ${formatWhen(visit.paidUntil)}.`
              : visit.overtime
                ? overtimeSentence(visit.overtime)
                : `Play time ended at ${formatWhen(visit.paidUntil)}.`}
        </p>
        <p>Phone on this ticket: {formatPhone(visit.phone)}</p>
        <p>Still due at the venue: {formatNu(visit.dueNu)}</p>
      </section>
    </main>
  );
}
