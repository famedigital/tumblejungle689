"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Tag,
  Package,
  Clock,
  QrCode,
  ArrowLeft,
  Search,
  Plus,
  RefreshCw,
  Check,
  CreditCard,
  Banknote,
  AlertTriangle,
  Save,
} from "lucide-react";
import type { MenuItem, Rate } from "@/lib/types";

export default function V2AdminDashboard() {
  const [activeTab, setActiveTab] = useState<"sales" | "menu" | "stock" | "rates" | "settings">("sales");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  // Data
  const [dayMetrics, setDayMetrics] = useState({
    totalNu: 0,
    playNu: 0,
    foodNu: 0,
    cashNu: 0,
    bankNu: 0,
    settledCount: 0,
    openCount: 0,
  });
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string; outlet: string }[]>([]);
  const [stockItems, setStockItems] = useState<(MenuItem & { soldToday: number; low: boolean })[]>([]);
  const [rates, setRates] = useState<Rate[]>([]);
  const [extraPerMinNu, setExtraPerMinNu] = useState(10);
  const [venueSettings, setVenueSettings] = useState({
    venueName: "Tumble Jungle",
    tagline: "",
    address: "Changjiji, Thimphu",
    phone: "",
    ownerPhone: "",
    hours: "",
    bankPayload: "",
    bankAccount: "",
    payee: "",
    city: "Thimphu",
    receiptThanks: "Thank you for visiting Tumble Jungle!",
    receiptNote: "",
  });

  // Filters & Sub-modals
  const [menuSearch, setMenuSearch] = useState("");
  const [menuFilterCat, setMenuFilterCat] = useState("all");
  const [editingItem, setEditingItem] = useState<Partial<MenuItem> | null>(null);
  const [restockModalItem, setRestockModalItem] = useState<MenuItem | null>(null);
  const [restockQty, setRestockQty] = useState(12);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v2/admin/data");
      if (!res.ok) throw new Error("Failed to load admin data");
      const data = await res.json();
      setDayMetrics(data.day);
      setMenu(data.menu);
      setCategories(data.categories);
      setStockItems(data.stock);
      setRates(data.settings.rates || []);
      setExtraPerMinNu(data.settings.extraPerMinNu || 10);
      setVenueSettings(data.settings);
    } catch (err) {
      console.error("Admin fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    fetch("/api/v2/admin/data")
      .then((res) => res.json())
      .then((data) => {
        if (!mounted) return;
        setDayMetrics(data.day);
        setMenu(data.menu);
        setCategories(data.categories);
        setStockItems(data.stock);
        setRates(data.settings.rates || []);
        setExtraPerMinNu(data.settings.extraPerMinNu || 10);
        setVenueSettings(data.settings);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Admin fetch error:", err);
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const triggerToast = (msg: string) => {
    setSaveMessage(msg);
    setTimeout(() => setSaveMessage(""), 2000);
  };

  // Save Item Price / Active status
  const handleSaveItem = async (item: Partial<MenuItem>) => {
    setSaving(true);
    try {
      const res = await fetch("/api/v2/admin/item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });
      if (!res.ok) throw new Error("Failed to save item");
      const { menu: updatedMenu } = await res.json();
      setMenu(updatedMenu);
      setEditingItem(null);
      triggerToast("Item updated successfully!");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error saving item");
    } finally {
      setSaving(false);
    }
  };

  // Adjust Stock
  const handleAdjustStock = async (itemId: number, delta: number, note = "Manual adjustment") => {
    try {
      const res = await fetch("/api/v2/admin/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "adjust", itemId, delta, note }),
      });
      if (!res.ok) throw new Error("Failed to adjust stock");
      const { stock: updatedStock } = await res.json();
      setStockItems(updatedStock);
      triggerToast(`Stock updated (${delta > 0 ? `+${delta}` : delta})`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Stock error");
    }
  };

  // Save Rates
  const handleSaveRates = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/v2/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: "rates",
          data: { rates, extraPerMinNu },
        }),
      });
      if (!res.ok) throw new Error("Failed to save rates");
      triggerToast("Play rates saved successfully!");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save rates");
    } finally {
      setSaving(false);
    }
  };

  // Save Venue & Bank
  const handleSaveSettings = async (section: "venue" | "bank" | "receipt") => {
    setSaving(true);
    try {
      const res = await fetch("/api/v2/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section,
          data: venueSettings,
        }),
      });
      if (!res.ok) throw new Error("Failed to save settings");
      triggerToast("Settings saved successfully!");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Settings save failed");
    } finally {
      setSaving(false);
    }
  };

  // Filtered Menu
  const filteredMenu = menu.filter((item) => {
    if (menuFilterCat !== "all" && item.category !== menuFilterCat) return false;
    if (menuSearch.trim()) {
      const q = menuSearch.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        (item.category && item.category.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const lowStockCount = stockItems.filter((s) => s.low).length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 flex flex-col font-sans antialiased selection:bg-emerald-500 selection:text-white">
      {/* Top Admin Navigation Header */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl px-4 md:px-8 py-3.5 transition-colors">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/v2"
              className="p-2 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
              title="Return to POS"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-base md:text-lg tracking-tight text-slate-900 dark:text-white">
                  Admin Command Hub
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                  Manager
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {venueSettings.venueName} • Real-time Sync
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {saveMessage && (
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2.5 py-1 rounded-lg animate-in fade-in">
                <Check className="h-3.5 w-3.5" /> {saveMessage}
              </span>
            )}
            <button
              type="button"
              onClick={fetchAdminData}
              disabled={loading}
              className="p-2 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
              title="Refresh Data"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Tab Switcher Bar */}
      <div className="border-b border-slate-200/80 dark:border-white/10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md px-4 md:px-8">
        <div className="max-w-7xl mx-auto flex items-center gap-1.5 overflow-x-auto py-2.5 scrollbar-none">
          {[
            { id: "sales", label: "Sales & Auditor", icon: TrendingUp },
            { id: "menu", label: "Menu & Prices", icon: Tag },
            { id: "stock", label: `Stock (${lowStockCount} Low)`, icon: Package, badge: lowStockCount > 0 },
            { id: "rates", label: "Play Durations", icon: Clock },
            { id: "settings", label: "Bank QR & Venue", icon: QrCode },
          ].map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs md:text-sm font-bold whitespace-nowrap transition-all ${
                  active
                    ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60"
                }`}
              >
                <tab.icon className="h-4 w-4" />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 space-y-6">
        {/* ============================================================
            TAB 1: SALES & DAY AUDITOR
        ============================================================ */}
        {activeTab === "sales" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              <div className="p-4 md:p-5 rounded-3xl bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/30 shadow-sm">
                <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-emerald-600" /> Today&apos;s Revenue
                </span>
                <p className="font-mono font-black text-2xl md:text-3xl text-emerald-700 dark:text-emerald-400 mt-2">
                  Nu. {dayMetrics.totalNu}
                </p>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
                  {dayMetrics.settledCount} settled transactions
                </span>
              </div>

              <div className="p-4 md:p-5 rounded-3xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-white/10 shadow-sm">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-blue-500" /> Play Passes
                </span>
                <p className="font-mono font-black text-2xl md:text-3xl text-slate-900 dark:text-white mt-2">
                  Nu. {dayMetrics.playNu}
                </p>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
                  {dayMetrics.openCount} currently playing
                </span>
              </div>

              <div className="p-4 md:p-5 rounded-3xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-white/10 shadow-sm">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <CreditCard className="h-4 w-4 text-purple-500" /> Bank QR (mBOB)
                </span>
                <p className="font-mono font-black text-2xl md:text-3xl text-purple-600 dark:text-purple-400 mt-2">
                  Nu. {dayMetrics.bankNu}
                </p>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
                  Digital EMV transfers
                </span>
              </div>

              <div className="p-4 md:p-5 rounded-3xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-white/10 shadow-sm">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <Banknote className="h-4 w-4 text-amber-500" /> Cash Drawer
                </span>
                <p className="font-mono font-black text-2xl md:text-3xl text-amber-600 dark:text-amber-400 mt-2">
                  Nu. {dayMetrics.cashNu}
                </p>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
                  Cash collected
                </span>
              </div>
            </div>

            {/* Quick Actions & Legacy Full Ledger Link */}
            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Need the complete ledger or void receipts?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  View full historical transaction logs, print daily end-of-day z-reports, and audit voided tickets.
                </p>
              </div>
              <div className="flex items-center gap-2 w-full md:w-auto">
                <a
                  href="/admin"
                  className="w-full md:w-auto text-center px-4 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition-all"
                >
                  Open Classic Daily Auditor
                </a>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================
            TAB 2: MENU & PRICES
        ============================================================ */}
        {activeTab === "menu" && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Filter & Search Header */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search dishes, drinks, prices..."
                  value={menuSearch}
                  onChange={(e) => setMenuSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => setMenuFilterCat("all")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    menuFilterCat === "all"
                      ? "bg-emerald-600 text-white"
                      : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  All ({menu.length})
                </button>
                {Array.from(new Set(menu.map((m) => m.category || "General"))).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setMenuFilterCat(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                      menuFilterCat === cat
                        ? "bg-emerald-600 text-white"
                        : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {cat}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setEditingItem({ name: "", priceNu: 100, active: true, categoryId: categories[0]?.id })}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shadow-sm"
                >
                  <Plus className="h-4 w-4" /> Add Item
                </button>
              </div>
            </div>

            {/* Menu Items Table / Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredMenu.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-slate-900/60 shadow-sm flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800">
                        {item.category} • {item.outlet}
                      </span>
                      <h4 className="font-extrabold text-base text-slate-900 dark:text-white mt-1">
                        {item.name}
                      </h4>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSaveItem({ id: item.id, active: !item.active, name: item.name, priceNu: item.priceNu })}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all ${
                        item.active
                          ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-700 dark:text-emerald-300"
                          : "bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-500"
                      }`}
                    >
                      {item.active ? "Active" : "Hidden"}
                    </button>
                  </div>

                  {/* Price Row & Quick Editor */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/5">
                    <div>
                      <span className="text-[10px] text-slate-600 dark:text-slate-300 uppercase block font-semibold">Price</span>
                      <span className="font-mono font-black text-lg text-emerald-600 dark:text-emerald-400">
                        Nu. {item.priceNu}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleSaveItem({ id: item.id, name: item.name, priceNu: Math.max(0, item.priceNu - 10), active: item.active })}
                        className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 font-mono text-xs font-bold text-slate-700 dark:text-slate-300"
                      >
                        -10
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveItem({ id: item.id, name: item.name, priceNu: item.priceNu + 10, active: item.active })}
                        className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 font-mono text-xs font-bold text-slate-700 dark:text-slate-300"
                      >
                        +10
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingItem(item)}
                        className="px-3 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-bold ml-1"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============================================================
            TAB 3: STOCK & INVENTORY
        ============================================================ */}
        {activeTab === "stock" && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {lowStockCount > 0 && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs font-medium flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <strong>{lowStockCount} item(s) are low on stock</strong> and need to be reordered.
                </span>
              </div>
            )}

            <div className="rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-slate-900/60 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-white/10 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="p-4">Item Name</th>
                      <th className="p-4">Category</th>
                      <th className="p-4">Stock On Hand</th>
                      <th className="p-4">Reorder Threshold</th>
                      <th className="p-4">Price (Nu.)</th>
                      <th className="p-4 text-right">Quick Stock In / Adjust</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-medium">
                    {stockItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="p-4 font-bold text-slate-900 dark:text-white">
                          {item.name}
                        </td>
                        <td className="p-4 text-slate-500">{item.category}</td>
                        <td className="p-4">
                          <span
                            className={`px-2.5 py-1 rounded-full font-mono font-bold text-xs ${
                              item.low
                                ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                                : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                            }`}
                          >
                            {item.stockQty} in stock
                          </span>
                        </td>
                        <td className="p-4 font-mono text-slate-500">{item.reorderQty}</td>
                        <td className="p-4 font-mono font-bold text-emerald-600">Nu. {item.priceNu}</td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleAdjustStock(item.id, -1, "Count reduction")}
                              className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-bold"
                            >
                              -1
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAdjustStock(item.id, 1, "Count addition")}
                              className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-bold"
                            >
                              +1
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRestockModalItem(item);
                                setRestockQty(12);
                              }}
                              className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold ml-1"
                            >
                              + Restock
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================
            TAB 4: PLAY RATES & PRICING
        ============================================================ */}
        {activeTab === "rates" && (
          <div className="max-w-2xl space-y-6 animate-in fade-in duration-200">
            <div className="p-6 rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-slate-900/60 shadow-sm space-y-4">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Play Burst Pricing Tiers
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Update customer prices for play passes. Reflected instantly across all mobile staff devices.
                </p>
              </div>

              <div className="space-y-3">
                {rates.map((rate, idx) => (
                  <div
                    key={rate.minutes}
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">
                        {rate.minutes}m
                      </div>
                      <span className="font-bold text-sm text-slate-900 dark:text-white">
                        {rate.minutes} Minutes Duration
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 font-mono">Nu.</span>
                      <input
                        type="number"
                        value={rate.amountNu}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 0;
                          const next = [...rates];
                          next[idx] = { ...next[idx], amountNu: val };
                          setRates(next);
                        }}
                        className="w-24 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-bold text-sm text-right focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Overtime Fee */}
              <div className="pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                    Overtime Fee (per extra minute)
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Charged when children stay past their play time
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-mono">Nu./min</span>
                  <input
                    type="number"
                    value={extraPerMinNu}
                    onChange={(e) => setExtraPerMinNu(Number(e.target.value) || 0)}
                    className="w-24 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-bold text-sm text-right focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleSaveRates}
                disabled={saving}
                className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-emerald-600/30 transition-all disabled:opacity-50"
              >
                <Save className="h-4 w-4" /> Save Play Rates
              </button>
            </div>
          </div>
        )}

        {/* ============================================================
            TAB 5: BANK QR & VENUE SETTINGS
        ============================================================ */}
        {activeTab === "settings" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-200">
            {/* Bhutan RMA EMV QR Configuration */}
            <div className="p-6 rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-slate-900/60 shadow-sm space-y-4">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <QrCode className="h-5 w-5 text-purple-600" /> Bhutan RMA Bank QR
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  National EMV QR code scanned by mBOB / BDB / DrukPay on staff phones
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1">
                    Static EMV Payload String
                  </label>
                  <textarea
                    rows={4}
                    value={venueSettings.bankPayload}
                    onChange={(e) => setVenueSettings({ ...venueSettings, bankPayload: e.target.value })}
                    placeholder="00020101021109169400..."
                    className="w-full font-mono text-xs px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1">
                    Payee / Account Name
                  </label>
                  <input
                    type="text"
                    value={venueSettings.payee}
                    onChange={(e) => setVenueSettings({ ...venueSettings, payee: e.target.value })}
                    placeholder="TENZIN OM"
                    className="w-full text-xs font-medium px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleSaveSettings("bank")}
                  disabled={saving}
                  className="w-full py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
                >
                  <Save className="h-4 w-4" /> Save Bank QR Settings
                </button>
              </div>
            </div>

            {/* Venue & Location Branding */}
            <div className="p-6 rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-slate-900/60 shadow-sm space-y-4">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Venue Information & Receipts
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Branding displayed on public website, wristbands, and WhatsApp receipts
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1">
                    Venue Name
                  </label>
                  <input
                    type="text"
                    value={venueSettings.venueName}
                    onChange={(e) => setVenueSettings({ ...venueSettings, venueName: e.target.value })}
                    className="w-full text-xs font-medium px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1">
                    Address / Location
                  </label>
                  <input
                    type="text"
                    value={venueSettings.address}
                    onChange={(e) => setVenueSettings({ ...venueSettings, address: e.target.value })}
                    className="w-full text-xs font-medium px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1">
                    Contact Phone (or WhatsApp Concierge)
                  </label>
                  <input
                    type="tel"
                    value={venueSettings.phone}
                    onChange={(e) => setVenueSettings({ ...venueSettings, phone: e.target.value })}
                    className="w-full text-xs font-medium px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleSaveSettings("venue")}
                  disabled={saving}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
                >
                  <Save className="h-4 w-4" /> Save Venue Details
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Edit / Add Menu Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-5 shadow-2xl space-y-4">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
              {editingItem.id ? "Edit Dish / Drink" : "Add New Item"}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase block mb-1">Name</label>
                <input
                  type="text"
                  value={editingItem.name || ""}
                  onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                  placeholder="e.g. Cheese Pizza"
                  className="w-full text-xs font-medium px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase block mb-1">Price (Nu.)</label>
                <input
                  type="number"
                  value={editingItem.priceNu || 0}
                  onChange={(e) => setEditingItem({ ...editingItem, priceNu: Number(e.target.value) || 0 })}
                  className="w-full font-mono text-xs font-bold px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase block mb-1">Category</label>
                <select
                  value={editingItem.categoryId || categories[0]?.id}
                  onChange={(e) => setEditingItem({ ...editingItem, categoryId: Number(e.target.value) })}
                  className="w-full text-xs font-medium px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.outlet})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Active on Menu</span>
                <input
                  type="checkbox"
                  checked={editingItem.active ?? true}
                  onChange={(e) => setEditingItem({ ...editingItem, active: e.target.checked })}
                  className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSaveItem(editingItem)}
                disabled={saving || !editingItem.name?.trim()}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restock Delivery Modal */}
      {restockModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-5 shadow-2xl space-y-4">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
              Restock {restockModalItem.name}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Current on-hand: {restockModalItem.stockQty} units
            </p>

            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase block mb-1">
                Units Received (+Qty)
              </label>
              <input
                type="number"
                min={1}
                value={restockQty}
                onChange={(e) => setRestockQty(Number(e.target.value) || 0)}
                className="w-full font-mono text-base font-bold px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRestockModalItem(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  handleAdjustStock(restockModalItem.id, restockQty, "Delivery received");
                  setRestockModalItem(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
              >
                Confirm Restock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
