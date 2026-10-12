import Link from "next/link";
import { PhotoFrame } from "@/components/photo-frame";
import { getSettings } from "@/lib/domain";

const CHIPS = [
  { label: "Soft play", wash: "bg-[#ffe8a3]" },
  { label: "Ball pit", wash: "bg-[#ffc9c0]" },
  { label: "Cafe treats", wash: "bg-[#b7ebe3]" },
  { label: "Family plates", wash: "bg-[#b9e8ff]" },
];

const LOOK = [
  {
    src: "/brand/hero-play.jpg",
    alt: "Green and yellow climbing frames with a small slide",
    label: "Climbing frames",
    className: "md:col-span-2 md:row-span-2",
  },
  {
    src: "/gallery/pit-overhead.jpg",
    alt: "A toddler surrounded by blue, yellow, and white balls",
    label: "In the balls",
    className: "md:row-span-2",
  },
  {
    src: "/gallery/balls.jpg",
    alt: "Children laughing and tossing red, yellow, blue, and green balls",
    label: "Play burst",
    className: "",
  },
  {
    src: "/brand/jungle-pit.jpg",
    alt: "A bright ball pit beside a padded slide",
    label: "Soft play",
    className: "",
  },
  {
    src: "/brand/toddler-zone.jpg",
    alt: "A low toddler ball pool with padded steps",
    label: "Little ones",
    className: "",
  },
  {
    src: "/gallery/friends.jpg",
    alt: "Two children playing together beside a wooden slide",
    label: "Side by side",
    className: "md:col-span-2",
  },
  {
    src: "/brand/cafe.jpg",
    alt: "Tea and momos on the cafe counter, with soft play behind",
    label: "Cafe counter",
    className: "",
  },
  {
    src: "/brand/jungle-table.jpg",
    alt: "A family table set with rice, curry, and tea",
    label: "Family table",
    className: "",
  },
  {
    src: "/brand/restaurant.jpg",
    alt: "Rice, curry, and dal on a restaurant table",
    label: "Restaurant",
    className: "",
  },
  {
    src: "/gallery/baby-slide.jpg",
    alt: "A smiling baby at the bottom of a small indoor slide",
    label: "First slides",
    className: "",
  },
  {
    src: "/gallery/pit-rest.jpg",
    alt: "A child lying back in a colorful ball pit",
    label: "A soft landing",
    className: "",
  },
  {
    src: "/gallery/circle.jpg",
    alt: "Children sitting in a circle on green play flooring",
    label: "Together",
    className: "md:col-span-4",
  },
];

const STEPS = [
  {
    href: "/play",
    wash: "bg-[#ffe8a3]",
    kicker: "01",
    title: "Pick a play burst",
    copy: "30 minutes when energy is short. Two hours when nobody wants to leave.",
    src: "/gallery/pit-overhead.jpg",
    alt: "A toddler playing in a blue, yellow, and white ball pit",
  },
  {
    href: "/visit",
    wash: "bg-[#b7ebe3]",
    kicker: "02",
    title: "Keep the QR close",
    copy: "Ticket, sticker on a card, or the code open on a phone. Lost paper? The phone number finds the visit.",
    src: "/brand/hero-play.jpg",
    alt: "Climbing frames and a yellow slide in the play hall",
  },
  {
    href: "/eat",
    wash: "bg-[#ffc9c0]",
    kicker: "03",
    title: "Snack on the same tab",
    copy: "Cafe or restaurant scans the ticket. Pay at that counter, or clear the whole visit at the cashier.",
    src: "/brand/jungle-snacks.jpg",
    alt: "Momos, fries, juice, and cake ready to share",
  },
];

export default function HomePage() {
  const settings = getSettings();
  return (
    <main>
      <section className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-10 lg:grid-cols-[0.92fr_1.08fr] lg:py-14">
        <div className="space-y-5">
          <p className="inline-flex rounded-full bg-[#ffb703] px-3 py-1 text-sm font-medium text-[#3d2a00] shadow-sm">
            {settings.address}
          </p>
          <h1 className="font-heading text-5xl leading-[0.98] text-balance text-[#146047] sm:text-7xl">
            {settings.venueName}
          </h1>
          <p className="max-w-xl text-2xl leading-snug text-[#1f4d3a]">{settings.tagline}</p>
          <p className="max-w-xl text-base leading-relaxed text-[#245c46]">{settings.about}</p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/play"
              className="inline-flex h-12 items-center rounded-full bg-[#1f7a5a] px-5 text-sm font-medium text-white shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffb703]"
            >
              See play times
            </Link>
            <Link
              href="/eat"
              className="inline-flex h-12 items-center rounded-full bg-[#ff7a59] px-5 text-sm font-medium text-white shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f7a5a]"
            >
              Peek at the menu
            </Link>
          </div>
          <ul className="flex flex-wrap gap-2 pt-1">
            {CHIPS.map((chip) => (
              <li key={chip.label} className={`rounded-full px-3 py-1 text-sm font-medium text-[#1f4d3a] ${chip.wash}`}>
                {chip.label}
              </li>
            ))}
          </ul>
        </div>
        <div className="grid grid-cols-6 gap-3">
          <PhotoFrame
            src="/brand/jungle-hero.jpg"
            alt="Colorful indoor jungle soft play with a yellow slide and red ball pit"
            className="col-span-6 aspect-[16/10] rounded-[2rem] shadow-xl ring-4 ring-[#ffb703]"
          />
          <PhotoFrame
            src="/gallery/pit-smile.jpg"
            alt="A child playing in a bright ball pit"
            label="Ball pit"
            className="col-span-3 aspect-square rounded-[1.5rem] shadow-lg ring-4 ring-white"
          />
          <PhotoFrame
            src="/brand/jungle-snacks.jpg"
            alt="Juice, momos, fries, and cake on a green tray"
            label="Cafe"
            className="col-span-3 aspect-square rounded-[1.5rem] shadow-lg ring-4 ring-white"
          />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium tracking-[0.16em] text-[#c2410c] uppercase">Look around</p>
            <h2 className="font-heading text-4xl text-[#146047] sm:text-5xl">More of the jungle</h2>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-[#1f4d3a]">
            Slides, pits, and a table for the grown-ups. The same visit covers all of it.
          </p>
        </div>
        <div className="mt-5 grid auto-rows-[10.5rem] grid-cols-2 gap-3 md:auto-rows-[12rem] md:grid-cols-4">
          {LOOK.map((photo) => (
            <PhotoFrame
              key={photo.src + photo.label}
              src={photo.src}
              alt={photo.alt}
              label={photo.label}
              className={`h-full rounded-[1.4rem] shadow-md ring-2 ring-white ${photo.className}`}
            />
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 py-12 md:grid-cols-3">
        {STEPS.map((step) => (
          <Link
            key={step.href}
            href={step.href}
            className={`group overflow-hidden rounded-[1.6rem] shadow-sm transition hover:-translate-y-1 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f7a5a] motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${step.wash}`}
          >
            <img src={step.src} alt={step.alt} className="aspect-[16/10] w-full object-cover" />
            <div className="p-5">
              <p className="font-heading text-3xl text-[#1f4d3a]/45">{step.kicker}</p>
              <h2 className="mt-1 font-heading text-2xl group-hover:underline">{step.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-[#1f4d3a]">{step.copy}</p>
            </div>
          </Link>
        ))}
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="grid items-center gap-6 overflow-hidden rounded-[2rem] bg-[#146047] p-4 text-white shadow-xl sm:p-6 lg:grid-cols-[1.1fr_0.9fr]">
          <PhotoFrame
            src="/gallery/pit-smile.jpg"
            alt="A child playing in a bright ball pit"
            className="aspect-[16/10] rounded-[1.4rem]"
          />
          <div className="space-y-3 px-2 py-2 sm:px-4">
            <p className="text-sm font-medium tracking-[0.16em] text-[#ffb703] uppercase">One visit</p>
            <h2 className="font-heading text-4xl leading-tight">Play first. Eat when hunger hits.</h2>
            <p className="text-[#d7f5ea]">
              Pay for a block of play, keep one QR ticket, and add cafe or restaurant orders on the same tab.
            </p>
            <Link
              href="/visit"
              className="inline-flex h-12 items-center rounded-full bg-[#ffb703] px-5 text-sm font-medium text-[#3d2a00] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              How a visit works
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
