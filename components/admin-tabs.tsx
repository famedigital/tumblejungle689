"use client";

import { useState } from "react";

export function AdminTabs({
  tabs,
}: {
  tabs: { id: string; label: string; panel: React.ReactNode }[];
}) {
  const [active, setActive] = useState(tabs[0]?.id ?? "floor");
  const washes = ["bg-[#ffd6e8]", "bg-[#d7fff3]", "bg-[#fff3bf]", "bg-[#e4d4ff]", "bg-[#ffd8c2]", "bg-[#d6f4ff]"];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Dashboard">
        {tabs.map((tab, index) => {
          const selected = active === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(tab.id)}
              className={`h-11 rounded-full px-4 text-sm font-medium transition hover:-translate-y-0.5 ${
                selected ? "bg-primary text-primary-foreground shadow-sm" : `${washes[index % washes.length]} text-foreground`
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div key={tab.id} role="tabpanel" hidden={active !== tab.id} className="space-y-5">
          {tab.panel}
        </div>
      ))}
    </div>
  );
}
