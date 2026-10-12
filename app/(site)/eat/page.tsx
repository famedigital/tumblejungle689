import { MenuBoard } from "@/components/menu-board";
import { PhotoFrame } from "@/components/photo-frame";
import { getSettings, listMenu } from "@/lib/domain";

const PLATES = [
  {
    src: "/brand/jungle-snacks.jpg",
    alt: "Juice, momos, fries, cake, and milk tea on a green tray",
    label: "Cafe tray",
  },
  {
    src: "/brand/cafe.jpg",
    alt: "Two cups of tea and a plate of momos on the cafe counter",
    label: "Quick treats",
  },
  {
    src: "/brand/jungle-table.jpg",
    alt: "Rice, curry, and tea on a wooden family table",
    label: "Family table",
  },
  {
    src: "/brand/restaurant.jpg",
    alt: "Rice, chicken curry, and dal in the restaurant",
    label: "A proper plate",
  },
];

export default function EatPage() {
  const settings = getSettings();
  const menu = listMenu();
  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-10">
      <div className="grid items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-3">
          <p className="text-sm font-medium tracking-[0.16em] text-[#c2410c] uppercase">Hungry already?</p>
          <h1 className="font-heading text-5xl text-[#146047]">Cafe and restaurant</h1>
          <p className="max-w-xl text-lg leading-relaxed text-[#1f4d3a]">{settings.eatBlurb}</p>
          {settings.menuIsSample ? (
            <p className="rounded-2xl bg-[#ffe1dc] px-4 py-3 text-sm text-[#7f1d1d]">
              This menu is a sample. Dishes and prices change from Admin.
            </p>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {PLATES.map((plate, index) => (
            <PhotoFrame
              key={plate.src}
              src={plate.src}
              alt={plate.alt}
              label={plate.label}
              className={`aspect-[4/5] rounded-[1.5rem] shadow-md ring-4 ring-white ${index % 2 === 1 ? "mt-6" : ""}`}
            />
          ))}
        </div>
      </div>
      <MenuBoard items={menu} />
    </main>
  );
}
