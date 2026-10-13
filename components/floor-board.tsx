"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Banknote,
  Clock3,
  Coffee,
  QrCode,
  Store,
  Timer,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatNu, formatPhone, formatWhen } from "@/lib/format";
import type { FloorPulse } from "@/lib/domain";

const PINK = "#ec4899";
const MINT = "#14b8a6";
const LEMON = "#f5b942";
const LILAC = "#8b5cf6";

export function FloorBoard({ pulse }: { pulse: FloorPulse }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 12000);
    return () => clearInterval(timer);
  }, [router]);

  const { summary } = pulse;
  const mix = [
    { name: "Play", value: summary.playNu, fill: PINK },
    { name: "Food", value: summary.foodNu, fill: MINT },
  ].filter((row) => row.value > 0);
  const tenders = [
    { name: "Cash", value: summary.cashNu, fill: LEMON },
    { name: "Bank QR", value: summary.bankNu, fill: LILAC },
  ].filter((row) => row.value > 0);
  const stationPeak = Math.max(1, ...pulse.stations.map((row) => row.amount));
  const stats = [
    { label: "Takings", value: formatNu(summary.totalNu), hint: summary.key, icon: Wallet, wash: "bg-[#ffd6e8]" },
    { label: "Play", value: formatNu(summary.playNu), hint: "Desk and extra time", icon: Timer, wash: "bg-[#e4d4ff]" },
    { label: "Food", value: formatNu(summary.foodNu), hint: "Cafe and restaurant", icon: UtensilsCrossed, wash: "bg-[#d7fff3]" },
    { label: "On the floor", value: String(summary.openCount), hint: `${summary.settledCount} closed today`, icon: Activity, wash: "bg-[#fff3bf]" },
  ];

  return (
    <div className="space-y-4">
      <p className="flex items-center gap-2 text-xs font-medium text-primary">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-70" />
          <span className="relative inline-flex size-2 rounded-full bg-primary" />
        </span>
        Live floor · refreshes every 12 seconds · {formatWhen(pulse.at)}
      </p>

      <section className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 xl:grid-cols-4">
        {stats.map((stat) => (
          <article key={stat.label} className={`w-[11.5rem] shrink-0 rounded-3xl p-4 sm:w-auto ${stat.wash}`}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{stat.label}</p>
              <stat.icon className="size-5" aria-hidden />
            </div>
            <p className="mt-2 font-heading text-3xl tabular-nums">{stat.value}</p>
            <p className="text-xs text-foreground/70">{stat.hint}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-3 lg:grid-cols-5">
        <article className="rounded-3xl bg-card p-4 ring-1 ring-foreground/10 lg:col-span-3">
          <header className="mb-2 flex items-center gap-2">
            <Clock3 className="size-4 text-primary" aria-hidden />
            <h2 className="font-heading text-xl">Today by hour</h2>
          </header>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pulse.hours}>
                <CartesianGrid vertical={false} stroke="oklch(0.9 0.04 350)" />
                <XAxis dataKey="hour" tick={{ fontSize: 11 }} interval={1} />
                <YAxis tick={{ fontSize: 11 }} width={36} />
                <Tooltip formatter={(value) => formatNu(Number(value ?? 0))} />
                <Bar dataKey="play" name="Play" fill={PINK} radius={[6, 6, 0, 0]} />
                <Bar dataKey="food" name="Food" fill={MINT} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
        <article className="rounded-3xl bg-card p-4 ring-1 ring-foreground/10 lg:col-span-2">
          <header className="mb-2 flex items-center gap-2">
            <Banknote className="size-4 text-primary" aria-hidden />
            <h2 className="font-heading text-xl">This week</h2>
          </header>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={pulse.week}>
                <CartesianGrid vertical={false} stroke="oklch(0.9 0.04 350)" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={36} />
                <Tooltip formatter={(value) => formatNu(Number(value ?? 0))} />
                <Area type="monotone" dataKey="total" name="Takings" stroke={LILAC} fill={LILAC} fillOpacity={0.25} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        <MixChart title="Play and food" icon={UtensilsCrossed} rows={mix} empty="No takings yet today." />
        <MixChart title="Cash and bank QR" icon={QrCode} rows={tenders} empty="No tenders yet today." />
        <article className="rounded-3xl bg-card p-4 ring-1 ring-foreground/10">
          <header className="mb-3 flex items-center gap-2">
            <Store className="size-4 text-primary" aria-hidden />
            <h2 className="font-heading text-xl">By counter</h2>
          </header>
          <ul className="space-y-3">
            {pulse.stations.map((row) => (
              <li key={row.station}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="flex items-center gap-1 capitalize">
                    {row.station === "cafe" ? <Coffee className="size-3.5" aria-hidden /> : null}
                    {row.station}
                  </span>
                  <span className="tabular-nums">{formatNu(row.amount)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-[width]"
                    style={{ width: `${Math.round((row.amount / stationPeak) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <article className="rounded-3xl bg-card p-4 ring-1 ring-foreground/10">
        <header className="mb-3 flex items-center gap-2">
          <Activity className="size-4 text-primary" aria-hidden />
          <h2 className="font-heading text-xl">Open visits</h2>
        </header>
        {pulse.open.length === 0 ? <p className="text-sm text-muted-foreground">The floor is clear.</p> : null}
        <ul className="grid gap-2 md:grid-cols-2">
          {pulse.open.map((visit) => {
            const overtime = visit.minutes < 0;
            const width = overtime ? 100 : Math.min(100, Math.round((visit.minutes / 120) * 100));
            return (
              <li key={visit.code} className={`rounded-2xl p-3 ${overtime ? "bg-[#ffe1dc]" : "bg-[#d7fff3]"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono">{visit.code}</span>
                  <span className="text-sm">{formatPhone(visit.phone)}</span>
                </div>
                <p className="mt-1 text-sm">
                  {visit.children} children · {formatNu(visit.dueNu)} due ·{" "}
                  {overtime ? `${Math.abs(visit.minutes)} min overtime` : `${visit.minutes} min left`}
                </p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/70">
                  <div className={`h-full rounded-full ${overtime ? "bg-[#ef6f5e]" : "bg-[#14b8a6]"}`} style={{ width: `${width}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      </article>

      <article className="rounded-3xl bg-card p-4 ring-1 ring-foreground/10">
        <header className="mb-3 flex items-center gap-2">
          <Wallet className="size-4 text-primary" aria-hidden />
          <h2 className="font-heading text-xl">Latest payments</h2>
        </header>
        {summary.payments.length === 0 ? <p className="text-sm text-muted-foreground">Nothing has been taken today.</p> : null}
        <ul className="divide-y text-sm">
          {summary.payments.slice(0, 8).map((payment) => (
            <li key={payment.id} className="flex justify-between gap-3 py-2">
              <span className="capitalize">
                {payment.kind} · {payment.method === "bank_qr" ? "bank QR" : "cash"} · {payment.station}
              </span>
              <span className="tabular-nums">
                {formatNu(payment.amountNu)} · {formatWhen(payment.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      </article>
    </div>
  );
}

function MixChart({
  title,
  icon: Icon,
  rows,
  empty,
}: {
  title: string;
  icon: typeof Wallet;
  rows: { name: string; value: number; fill: string }[];
  empty: string;
}) {
  return (
    <article className="rounded-3xl bg-card p-4 ring-1 ring-foreground/10">
      <header className="mb-2 flex items-center gap-2">
        <Icon className="size-4 text-primary" aria-hidden />
        <h2 className="font-heading text-xl">{title}</h2>
      </header>
      {rows.length === 0 ? (
        <p className="flex h-40 items-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={rows} dataKey="value" nameKey="name" innerRadius={42} outerRadius={68} paddingAngle={3}>
                {rows.map((row) => (
                  <Cell key={row.name} fill={row.fill} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatNu(Number(value ?? 0))} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
      <ul className="mt-2 flex flex-wrap gap-3 text-xs">
        {rows.map((row) => (
          <li key={row.name} className="flex items-center gap-1">
            <span className="size-2 rounded-full" style={{ background: row.fill }} />
            {row.name} {formatNu(row.value)}
          </li>
        ))}
      </ul>
    </article>
  );
}
