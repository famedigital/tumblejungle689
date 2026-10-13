import { PhotoFrame } from "@/components/photo-frame";
import { PlayCards } from "@/components/play-cards";
import { getSettings } from "@/lib/domain";

const FRAMES = [
  {
    src: "/brand/jungle-hero.jpg",
    alt: "Jungle-colored climbing frames, a yellow tube slide, and a red ball pit",
    label: "The hall",
  },
  {
    src: "/gallery/pit-smile.jpg",
    alt: "A child sitting among red, blue, yellow, and green balls",
    label: "Ball pit",
  },
  {
    src: "/brand/jungle-pit.jpg",
    alt: "A padded slide emptying into a multicolored ball pit",
    label: "Soft play",
  },
  {
    src: "/gallery/baby-slide.jpg",
    alt: "A smiling baby at the bottom of a small slide",
    label: "Little slides",
  },
  {
    src: "/brand/hero-play.jpg",
    alt: "Green climbing tunnels and a yellow slide",
    label: "Climb",
  },
];

export default async function PlayPage() {
  const settings = await getSettings();
  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-10">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {FRAMES.map((frame, index) => (
          <PhotoFrame
            key={frame.src}
            src={frame.src}
            alt={frame.alt}
            label={frame.label}
            className={`aspect-[4/3] rounded-[1.4rem] shadow-md ring-4 ring-white ${index === FRAMES.length - 1 ? "col-span-2 sm:col-span-1" : ""}`}
          />
        ))}
      </div>
      <div className="grid items-start gap-8 lg:grid-cols-[1.05fr_0.85fr]">
        <div className="space-y-4">
          <p className="text-sm font-medium tracking-[0.16em] text-[#1f7a5a] uppercase">Play hall</p>
          <h1 className="font-heading text-4xl text-[#146047] sm:text-5xl">How long are we staying?</h1>
          <p className="max-w-xl text-lg leading-relaxed text-[#1f4d3a]">{settings.playBlurb}</p>
          {settings.ratesAreSamples ? (
            <p className="rounded-2xl bg-[#fff1c9] px-4 py-3 text-sm text-[#6a4b00]">
              These prices are samples. Save the real rates in Admin before opening day.
            </p>
          ) : null}
          <PlayCards rates={settings.rates} />
        </div>
        <PhotoFrame
          src="/gallery/pit-rest.jpg"
          alt="A child resting in a colorful ball pit"
          label="Stay as long as the ticket"
          className="aspect-[4/5] rounded-[2rem] shadow-lg ring-4 ring-[#ffb703]"
        />
      </div>
    </main>
  );
}
