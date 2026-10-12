import { PhotoFrame } from "@/components/photo-frame";

const STEPS = [
  {
    wash: "bg-[#ffe8a3]",
    title: "At the desk",
    copy: "Share a phone number and choose 30 minutes, 1 hour, 90 minutes, or 2 hours. Play is paid before anyone goes in.",
    src: "/brand/jungle-hero.jpg",
    alt: "The indoor play hall with slides and a ball pit",
  },
  {
    wash: "bg-[#b7ebe3]",
    title: "The QR goes with you",
    copy: "Print a ticket, stick it on a card, or open it on a phone. Food ordered later stays on that same visit.",
    src: "/gallery/balls.jpg",
    alt: "Children playing with colorful balls",
  },
  {
    wash: "bg-[#b9e8ff]",
    title: "Paper gone?",
    copy: "Say the phone number. The open visit comes straight back, ready to scan again.",
    src: "/brand/toddler-zone.jpg",
    alt: "A small toddler ball pool with padded steps",
  },
  {
    wash: "bg-[#ffc9c0]",
    title: "Eat, then settle",
    copy: "Cafe and restaurant can take payment on the spot. Anything still open is cleared together at a cashier, including extra play time.",
    src: "/brand/jungle-table.jpg",
    alt: "A restaurant table set with rice, curry, and tea",
  },
];

export default function VisitInfoPage() {
  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-10">
      <div className="grid items-end gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="max-w-2xl space-y-3">
          <p className="text-sm font-medium tracking-[0.16em] text-[#1f7a5a] uppercase">One visit, one ticket</p>
          <h1 className="font-heading text-5xl text-[#146047]">How a Tumble Jungle visit works</h1>
        </div>
        <PhotoFrame
          src="/gallery/pit-overhead.jpg"
          alt="A toddler smiling in a ball pit of blue, yellow, and white balls"
          className="aspect-[16/9] rounded-[1.8rem] shadow-lg ring-4 ring-[#ffb703]"
        />
      </div>
      <ol className="grid gap-4 md:grid-cols-2">
        {STEPS.map((step, index) => (
          <li key={step.title} className={`overflow-hidden rounded-[1.6rem] ${step.wash}`}>
            <img src={step.src} alt={step.alt} className="aspect-[16/9] w-full object-cover" />
            <div className="p-5">
              <p className="font-heading text-3xl text-[#1f4d3a]/40">0{index + 1}</p>
              <h2 className="font-heading text-2xl">{step.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-[#1f4d3a]">{step.copy}</p>
            </div>
          </li>
        ))}
      </ol>
    </main>
  );
}
