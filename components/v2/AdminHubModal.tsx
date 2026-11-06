"use client";

import { useV2Store } from "@/lib/v2/store";
import {
  X,
  TrendingUp,
  Tag,
  Package,
  FileSpreadsheet,
  QrCode,
  Receipt,
  Tv,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  Banknote,
} from "lucide-react";

export function AdminHubModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const todayNu = useV2Store((s) => s.todayNu);
  const playNu = useV2Store((s) => s.playNu);
  const foodNu = useV2Store((s) => s.foodNu);
  const venueName = useV2Store((s) => s.venueName);

  if (!isOpen) return null;

  const adminNav = [
    {
      title: "Products & Prices",
      desc: "Update menu items, dish prices, and play durations",
      icon: Tag,
      href: "/admin/products",
      color: "text-blue-500 bg-blue-500/10",
    },
    {
      title: "Stock & Purchases",
      desc: "Track retail inventory, bottled drinks, and purchase costs",
      icon: Package,
      href: "/admin/stock",
      color: "text-amber-500 bg-amber-500/10",
    },
    {
      title: "Sales Report & AI Auditor",
      desc: "Full revenue breakdown, comps, voids, and audit ledger",
      icon: FileSpreadsheet,
      href: "/admin",
      color: "text-emerald-500 bg-emerald-500/10",
    },
    {
      title: "Bank QR & Venue Settings",
      desc: "Bhutan RMA QR payload, mBOB account, address, and phone",
      icon: QrCode,
      href: "/admin/bank",
      color: "text-purple-500 bg-purple-500/10",
    },
    {
      title: "Receipt Customizer",
      desc: "Thermal slip header, rules, thank-you notes, and tax options",
      icon: Receipt,
      href: "/admin/receipt",
      color: "text-rose-500 bg-rose-500/10",
    },
    {
      title: "Customer Display Screen",
      desc: "Launch the secondary pole/monitor screen for counter",
      icon: Tv,
      href: "/display",
      color: "text-cyan-500 bg-cyan-500/10",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-6 text-slate-900 dark:text-slate-100 flex flex-col max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-base text-slate-900 dark:text-white">
                Admin & Store Management
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {venueName || "Tumble Jungle"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Live Day Snapshot Cards */}
        <div className="my-4 space-y-2">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Today&apos;s Financial Summary
          </span>
          <div className="grid grid-cols-3 gap-2">
            <div className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-500/20">
              <span className="text-[10px] font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> Total Sales
              </span>
              <p className="font-mono font-black text-base text-emerald-700 dark:text-emerald-400 mt-1">
                Nu. {todayNu}
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                <CreditCard className="h-3 w-3" /> Play Passes
              </span>
              <p className="font-mono font-black text-base text-slate-900 dark:text-white mt-1">
                Nu. {playNu}
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                <Banknote className="h-3 w-3" /> Cafe & Food
              </span>
              <p className="font-mono font-black text-base text-slate-900 dark:text-white mt-1">
                Nu. {foodNu}
              </p>
            </div>
          </div>
        </div>

        {/* Admin Navigation Hub Links */}
        <div className="space-y-2">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Management Pages
          </span>
          <div className="space-y-2">
            {adminNav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all group shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${item.color}`}
                  >
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-emerald-600 transition-colors">
                      {item.title}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {item.desc}
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
