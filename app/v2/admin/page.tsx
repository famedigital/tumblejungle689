"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
  Upload,
  ShoppingCart,
  Truck,
  CheckCircle2,
  SlidersHorizontal,
  X,
  LogOut,
} from "lucide-react";
import { PayQr } from "@/components/pay-qr";
import type { MenuItem, Rate } from "@/lib/types";

type AdminTab = "sales" | "menu" | "stock" | "rates" | "settings";

function AdminDashboardInner() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as AdminTab | null;
  const validTabs: AdminTab[] = ["sales", "menu", "stock", "rates", "settings"];

  const urlTab: AdminTab = tabParam && validTabs.includes(tabParam) ? tabParam : "sales";
  const [selectedTab, setSelectedTab] = useState<AdminTab | null>(null);

  const activeTab = selectedTab ?? urlTab;

  const handleTabChange = (tab: AdminTab) => {
    setSelectedTab(tab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      window.history.replaceState({}, "", url.toString());
    }
  };

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

  const [purchases, setPurchases] = useState<
    { id: number; supplierName: string; totalNu: number; note: string; createdAt: string; lineCount: number }[]
  >([]);

  // Stock Sub-tabs & Modals
  const [stockSubTab, setStockSubTab] = useState<"on_hand" | "purchases">("on_hand");
  const [stockSearch, setStockSearch] = useState("");
  const [stockFilterOnlyLow, setStockFilterOnlyLow] = useState(false);

  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  const [trackItemId, setTrackItemId] = useState<number>(0);
  const [trackInitialQty, setTrackInitialQty] = useState<number>(12);
  const [trackReorderQty, setTrackReorderQty] = useState<number>(5);

  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustModalItem, setAdjustModalItem] = useState<(MenuItem & { soldToday: number; low: boolean }) | null>(null);
  const [adjustMode, setAdjustMode] = useState<"delta" | "exact">("delta");
  const [adjustDelta, setAdjustDelta] = useState<number>(0);
  const [adjustExactCount, setAdjustExactCount] = useState<string>("");
  const [adjustReason, setAdjustReason] = useState<string>("Inventory audit count");

  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [purchaseSupplier, setPurchaseSupplier] = useState<string>("");
  const [purchaseNote, setPurchaseNote] = useState<string>("");
  const [purchaseLines, setPurchaseLines] = useState<{ itemId: number; qty: number; unitCostNu: number }[]>([
    { itemId: 0, qty: 12, unitCostNu: 20 },
  ]);

  // Bank QR Upload state
  const [qrUploadBusy, setQrUploadBusy] = useState(false);
  const [qrUploadMsg, setQrUploadMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
      setPurchases(data.purchases || []);
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
        setPurchases(data.purchases || []);
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

  // Bank QR Photo Upload & Auto Decoder
  const handleBankQrUpload = async (file: File | undefined) => {
    if (!file) return;
    setQrUploadBusy(true);
    setQrUploadMsg(null);
    const url = URL.createObjectURL(file);
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const result = await new BrowserMultiFormatReader().decodeFromImageUrl(url);
      const { toStaticEmv, parseEmv } = await import("@/lib/emv");
      const normalized = toStaticEmv(result.getText());
      if (!normalized) {
        setQrUploadMsg({
          type: "error",
          text: "Image was read, but it is not a valid Bhutan RMA bank payment QR. Please upload a clear mBOB, BDB, or BNB payment QR.",
        });
        return;
      }
      const map = parseEmv(normalized);
      const payeeName = map.get("59") || venueSettings.payee || "Tumble Jungle";
      const cityName = map.get("60") || venueSettings.city || "Thimphu";
      const accountNum = map.get("26") || venueSettings.bankAccount;

      const nextSettings = {
        ...venueSettings,
        bankPayload: normalized,
        payee: payeeName,
        city: cityName,
        bankAccount: accountNum,
      };
      setVenueSettings(nextSettings);
      setQrUploadMsg({
        type: "success",
        text: `✓ Decoded Bhutan RMA QR for "${payeeName}"! Click "Save Bank QR Settings" to store.`,
      });
      triggerToast("Bank QR Decoded!");
    } catch (err) {
      console.error("QR decode error:", err);
      setQrUploadMsg({
        type: "error",
        text: "Could not read a QR code from this image. Please upload a clear, uncropped photo or screenshot of the bank QR.",
      });
    } finally {
      setQrUploadBusy(false);
      URL.revokeObjectURL(url);
    }
  };

  // Track New Item in Stock
  const handleTrackItem = async (itemId: number, initialQty: number, reorderQty: number) => {
    try {
      setSaving(true);
      const res = await fetch("/api/v2/admin/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "track",
          itemId,
          initialQty,
          reorderQty,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to track item");
      setStockItems(data.stock);
      if (data.purchases) setPurchases(data.purchases);
      setMenu((prev) =>
        prev.map((m) => (m.id === itemId ? { ...m, trackStock: true, stockQty: initialQty, reorderQty } : m))
      );
      setIsTrackModalOpen(false);
      triggerToast("Item now tracked in stock!");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error tracking item");
    } finally {
      setSaving(false);
    }
  };

  // Custom Stock Adjustment (+/- or set exact count)
  const handleAdjustStockCustom = async (
    itemId: number,
    delta: number,
    reason: string
  ) => {
    try {
      setSaving(true);
      const res = await fetch("/api/v2/admin/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "adjust",
          itemId,
          delta,
          note: reason,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to adjust stock");
      setStockItems(data.stock);
      if (data.purchases) setPurchases(data.purchases);
      setIsAdjustModalOpen(false);
      triggerToast(`Stock adjusted (${delta > 0 ? `+${delta}` : delta})`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error adjusting stock");
    } finally {
      setSaving(false);
    }
  };

  // Reorder Level Adjustment
  const handleUpdateReorderQty = async (itemId: number, reorderQty: number) => {
    try {
      const res = await fetch("/api/v2/admin/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reorder_level",
          itemId,
          reorderQty,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setStockItems(data.stock);
        triggerToast("Reorder threshold updated");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Save New Purchase Order
  const handleSavePurchase = async (
    supplierName: string,
    note: string,
    lines: { itemId: number; qty: number; unitCostNu: number }[]
  ) => {
    if (!supplierName.trim()) {
      alert("Please enter a supplier name.");
      return;
    }
    const validLines = lines.filter((l) => l.itemId > 0 && l.qty > 0);
    if (!validLines.length) {
      alert("Please add at least one item with quantity.");
      return;
    }
    try {
      setSaving(true);
      const res = await fetch("/api/v2/admin/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "purchase",
          supplierName: supplierName.trim(),
          note: note.trim(),
          lines: validLines,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record purchase");
      setStockItems(data.stock);
      if (data.purchases) setPurchases(data.purchases);
      setIsPurchaseModalOpen(false);
      setPurchaseSupplier("");
      setPurchaseNote("");
      triggerToast("Purchase received & stock updated!");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error recording purchase");
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
  const untrackedItems = menu.filter((item) => !item.trackStock && item.active);

  const filteredStock = stockItems.filter((item) => {
    if (stockFilterOnlyLow && !item.low) return false;
    if (stockSearch.trim()) {
      const q = stockSearch.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        (item.category && item.category.toLowerCase().includes(q))
      );
    }
    return true;
  });

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

            <button
              type="button"
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST" });
                window.location.href = "/login";
              }}
              title="Sign Out"
              className="p-2 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-rose-500 transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Tab Switcher Bar */}
      <div className="border-b border-slate-200/80 dark:border-white/10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md px-4 md:px-8">
        <div className="max-w-7xl mx-auto flex items-center gap-1.5 overflow-x-auto py-2.5 scrollbar-none">
          {[
            { id: "sales" as AdminTab, label: "Sales & Auditor", icon: TrendingUp },
            { id: "menu" as AdminTab, label: "Menu & Prices", icon: Tag },
            { id: "stock" as AdminTab, label: `Stock (${lowStockCount} Low)`, icon: Package, badge: lowStockCount > 0 },
            { id: "rates" as AdminTab, label: "Play Durations", icon: Clock },
            { id: "settings" as AdminTab, label: "Bank QR & Venue", icon: QrCode },
          ].map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
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

            {/* Quick Actions & Navigation */}
            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Quick Navigation
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Return to the live cashier counter or open the secondary pole display for visiting parents.
                </p>
              </div>
              <div className="flex items-center gap-2 w-full md:w-auto">
                <Link
                  href="/v2"
                  className="w-full md:w-auto text-center px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-sm"
                >
                  Back to Counter Station
                </Link>
                <a
                  href="/display"
                  target="_blank"
                  rel="noreferrer"
                  className="w-full md:w-auto text-center px-4 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition-all"
                >
                  Open Display
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
            TAB 3: STOCK & INVENTORY & PURCHASES
        ============================================================ */}
        {activeTab === "stock" && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Top Sub-tabs & Action Buttons */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200/80 dark:border-white/10">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStockSubTab("on_hand")}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                    stockSubTab === "on_hand"
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <Package className="h-4 w-4" />
                  <span>Stock On Hand ({stockItems.length})</span>
                  {lowStockCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                      {lowStockCount} low
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setStockSubTab("purchases")}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                    stockSubTab === "purchases"
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <ShoppingCart className="h-4 w-4" />
                  <span>Purchase Orders ({purchases.length})</span>
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    if (untrackedItems.length > 0) {
                      setTrackItemId(untrackedItems[0].id);
                    }
                    setIsTrackModalOpen(true);
                  }}
                  className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Track Item</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (stockItems.length > 0) {
                      setAdjustModalItem(stockItems[0]);
                      setAdjustDelta(0);
                      setAdjustExactCount(String(stockItems[0].stockQty));
                    }
                    setIsAdjustModalOpen(true);
                  }}
                  disabled={stockItems.length === 0}
                  className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5 text-amber-500" />
                  <span>Adjust Count</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const firstItem = stockItems[0] || menu[0];
                    setPurchaseLines([
                      { itemId: firstItem ? firstItem.id : 0, qty: 12, unitCostNu: firstItem ? firstItem.costNu || 20 : 20 },
                    ]);
                    setIsPurchaseModalOpen(true);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <ShoppingCart className="h-3.5 w-3.5" />
                  <span>+ Record Purchase</span>
                </button>
              </div>
            </div>

            {/* ================= VIEW 1: STOCK ON HAND ================= */}
            {stockSubTab === "on_hand" && (
              <div className="space-y-4">
                {/* Search & Low-stock Filter Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search stocked items..."
                      value={stockSearch}
                      onChange={(e) => setStockSearch(e.target.value)}
                      className="w-full text-xs font-medium pl-9 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={stockFilterOnlyLow}
                      onChange={(e) => setStockFilterOnlyLow(e.target.checked)}
                      className="h-4 w-4 rounded text-rose-600 focus:ring-rose-500"
                    />
                    <span>Show Low Stock Only ({lowStockCount})</span>
                  </label>
                </div>

                {lowStockCount > 0 && !stockFilterOnlyLow && (
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs font-medium flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <strong>{lowStockCount} item(s) are at or below reorder threshold</strong>.
                    </span>
                    <button
                      type="button"
                      onClick={() => setStockFilterOnlyLow(true)}
                      className="text-xs font-bold underline ml-2"
                    >
                      Filter Low Items
                    </button>
                  </div>
                )}

                {/* Stock Table */}
                <div className="rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-slate-900/60 overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-white/10 font-bold uppercase tracking-wider">
                        <tr>
                          <th className="p-4">Item Name</th>
                          <th className="p-4">Category</th>
                          <th className="p-4">Stock On Hand</th>
                          <th className="p-4">Reorder Level</th>
                          <th className="p-4">Unit Cost</th>
                          <th className="p-4">Sell Price</th>
                          <th className="p-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-medium">
                        {filteredStock.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="p-8 text-center text-slate-500">
                              {stockItems.length === 0
                                ? "No stocked items yet. Click '+ Track Item' to start tracking packaged drinks or snacks."
                                : "No items match your filter."}
                            </td>
                          </tr>
                        ) : (
                          filteredStock.map((item) => (
                            <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                              <td className="p-4">
                                <span className="font-bold text-slate-900 dark:text-white block">{item.name}</span>
                                <span className="text-[10px] text-slate-400 capitalize">{item.outlet} outlet</span>
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
                                  {item.stockQty} on hand
                                </span>
                              </td>
                              <td className="p-4">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono text-slate-600 dark:text-slate-400">{item.reorderQty}</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const next = prompt(`Enter reorder alert threshold for ${item.name}:`, String(item.reorderQty));
                                      if (next !== null && !isNaN(Number(next))) {
                                        handleUpdateReorderQty(item.id, Number(next));
                                      }
                                    }}
                                    className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700"
                                    title="Edit Reorder Level"
                                  >
                                    <SlidersHorizontal className="h-3 w-3" />
                                  </button>
                                </div>
                              </td>
                              <td className="p-4 font-mono text-slate-500">
                                Nu. {item.costNu || 0}
                              </td>
                              <td className="p-4 font-mono font-bold text-emerald-600">
                                Nu. {item.priceNu}
                              </td>
                              <td className="p-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleAdjustStock(item.id, -1, "Quick minus 1")}
                                    className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-bold"
                                    title="Deduct 1"
                                  >
                                    -1
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleAdjustStock(item.id, 1, "Quick add 1")}
                                    className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-bold"
                                    title="Add 1"
                                  >
                                    +1
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAdjustModalItem(item);
                                      setAdjustDelta(0);
                                      setAdjustExactCount(String(item.stockQty));
                                      setIsAdjustModalOpen(true);
                                    }}
                                    className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold"
                                  >
                                    Adjust
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRestockModalItem(item);
                                      setRestockQty(12);
                                    }}
                                    className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                                  >
                                    + Restock
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ================= VIEW 2: PURCHASE ORDERS ================= */}
            {stockSubTab === "purchases" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                      <Truck className="h-5 w-5 text-emerald-600" />
                      <span>Received Purchases & Supplier Invoices</span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      Every recorded purchase automatically updates stock levels and average cost.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const firstItem = stockItems[0] || menu[0];
                      setPurchaseLines([
                        { itemId: firstItem ? firstItem.id : 0, qty: 12, unitCostNu: firstItem ? firstItem.costNu || 20 : 20 },
                      ]);
                      setIsPurchaseModalOpen(true);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    <Plus className="h-4 w-4" />
                    <span>New Supplier Delivery</span>
                  </button>
                </div>

                <div className="rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-slate-900/60 overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-white/10 font-bold uppercase tracking-wider">
                        <tr>
                          <th className="p-4">PO Reference</th>
                          <th className="p-4">Supplier / Vendor</th>
                          <th className="p-4">Lines Count</th>
                          <th className="p-4">Total Nu.</th>
                          <th className="p-4">Invoice / Note</th>
                          <th className="p-4">Date Received</th>
                          <th className="p-4 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-medium">
                        {purchases.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="p-8 text-center text-slate-500">
                              No purchase records yet. Click &quot;+ Record Purchase&quot; to log incoming deliveries.
                            </td>
                          </tr>
                        ) : (
                          purchases.map((p) => (
                            <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                              <td className="p-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                PO-{p.id}
                              </td>
                              <td className="p-4 font-bold text-slate-900 dark:text-white">
                                {p.supplierName}
                              </td>
                              <td className="p-4 text-slate-500">{p.lineCount} items</td>
                              <td className="p-4 font-mono font-black text-slate-900 dark:text-white">
                                Nu. {p.totalNu}
                              </td>
                              <td className="p-4 text-slate-500">{p.note || "—"}</td>
                              <td className="p-4 font-mono text-[11px] text-slate-400">
                                {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "Today"}
                              </td>
                              <td className="p-4 text-right">
                                <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 text-[10px] font-bold">
                                  ✓ Stocked
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
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
                  Upload your venue mBOB, BDB, or BNB payment QR screenshot. Scanned by cashiers & parents during checkout.
                </p>
              </div>

              {/* QR Upload Zone */}
              <div className="p-4 rounded-2xl border-2 border-dashed border-purple-500/30 dark:border-purple-400/20 bg-purple-50/30 dark:bg-purple-950/20 text-center space-y-3">
                <div className="mx-auto h-10 w-10 rounded-full bg-purple-500/10 text-purple-600 flex items-center justify-center">
                  <Upload className="h-5 w-5" />
                </div>
                <div>
                  <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-sm transition-all">
                    <span>{qrUploadBusy ? "Decoding Bank QR..." : "Upload Bank QR Screenshot"}</span>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={qrUploadBusy}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleBankQrUpload(file);
                      }}
                      className="sr-only"
                    />
                  </label>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Accepts photos or screenshots of mBOB, BDB, BNB, or DrukPay QR codes
                  </p>
                </div>
              </div>

              {/* Upload Feedback Message */}
              {qrUploadMsg && (
                <div
                  className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                    qrUploadMsg.type === "success"
                      ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                      : "bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-300"
                  }`}
                >
                  {qrUploadMsg.type === "success" ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                  )}
                  <span>{qrUploadMsg.text}</span>
                </div>
              )}

              {/* Live QR Preview & Verified Details */}
              {venueSettings.bankPayload ? (
                <div className="flex items-center gap-4 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                  <div className="h-20 w-20 shrink-0 bg-white p-1 rounded-xl shadow-sm border border-slate-200 flex items-center justify-center overflow-hidden">
                    <PayQr
                      staticPayload={venueSettings.bankPayload}
                      amountNu={0}
                      note="Preview"
                      compact={true}
                    />
                  </div>
                  <div className="space-y-1 min-w-0">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      ✓ EMV Verified
                    </span>
                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                      {venueSettings.payee || "Payee Configured"}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {venueSettings.city || "Thimphu"} • {venueSettings.bankAccount || "Active"}
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="space-y-3 pt-2">
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1">
                    Payee / Account Name
                  </label>
                  <input
                    type="text"
                    value={venueSettings.payee}
                    onChange={(e) => setVenueSettings({ ...venueSettings, payee: e.target.value })}
                    placeholder="e.g. TENZIN OM"
                    className="w-full text-xs font-medium px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1">
                    Bank Account Number (Optional Reference)
                  </label>
                  <input
                    type="text"
                    value={venueSettings.bankAccount}
                    onChange={(e) => setVenueSettings({ ...venueSettings, bankAccount: e.target.value })}
                    placeholder="e.g. 2012938491"
                    className="w-full text-xs font-medium px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1">
                    Static EMV Payload String
                  </label>
                  <textarea
                    rows={3}
                    value={venueSettings.bankPayload}
                    onChange={(e) => setVenueSettings({ ...venueSettings, bankPayload: e.target.value })}
                    placeholder="00020101021109169400..."
                    className="w-full font-mono text-[11px] px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
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

      {/* Modal 1: Track New Item in Stock */}
      {isTrackModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Package className="h-5 w-5 text-blue-600" />
                <span>Track Item in Inventory</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsTrackModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select any existing menu product (bottled water, soft drinks, packaged chips) to start tracking physical stock levels.
            </p>

            {untrackedItems.length === 0 ? (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 text-center text-xs text-slate-500">
                All active products are already tracked in inventory! To stock a new item, create it under &quot;Menu &amp; Prices&quot; first.
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase block mb-1">
                    Select Product
                  </label>
                  <select
                    value={trackItemId}
                    onChange={(e) => setTrackItemId(Number(e.target.value))}
                    className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    {untrackedItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.category} • Nu. {item.priceNu})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase block mb-1">
                      Initial On-Hand Count
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={trackInitialQty}
                      onChange={(e) => setTrackInitialQty(Number(e.target.value) || 0)}
                      className="w-full font-mono text-sm font-bold px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase block mb-1">
                      Reorder Alert Level
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={trackReorderQty}
                      onChange={(e) => setTrackReorderQty(Number(e.target.value) || 5)}
                      className="w-full font-mono text-sm font-bold px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsTrackModalOpen(false)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTrackItem(trackItemId || untrackedItems[0].id, trackInitialQty, trackReorderQty)}
                    disabled={saving}
                    className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm"
                  >
                    Start Tracking
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal 2: Adjust Stock Count */}
      {isAdjustModalOpen && adjustModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <SlidersHorizontal className="h-5 w-5 text-amber-500" />
                <span>Adjust Stock: {adjustModalItem.name}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAdjustModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Current Stock Banner */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 block">Current Stock On Hand</span>
                <span className="text-xs text-slate-400">{adjustModalItem.category} • Nu. {adjustModalItem.priceNu}</span>
              </div>
              <span className="font-mono font-black text-2xl text-slate-900 dark:text-white">
                {adjustModalItem.stockQty}
              </span>
            </div>

            {/* Mode Switcher */}
            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80">
              <button
                type="button"
                onClick={() => setAdjustMode("delta")}
                className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                  adjustMode === "delta"
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-500 dark:text-slate-400"
                }`}
              >
                Add / Deduct (+/-)
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdjustMode("exact");
                  setAdjustExactCount(String(adjustModalItem.stockQty));
                }}
                className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                  adjustMode === "exact"
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-500 dark:text-slate-400"
                }`}
              >
                Set Exact Count
              </button>
            </div>

            {adjustMode === "delta" ? (
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase block mb-1">
                  Quantity Change (+ Add / − Deduct)
                </label>
                <input
                  type="number"
                  value={adjustDelta}
                  onChange={(e) => setAdjustDelta(Number(e.target.value) || 0)}
                  placeholder="e.g. +12 or -3"
                  className="w-full font-mono text-base font-bold px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Resulting on-hand will be: <strong>{adjustModalItem.stockQty + adjustDelta}</strong> units
                </span>
              </div>
            ) : (
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase block mb-1">
                  New Exact Physical Count
                </label>
                <input
                  type="number"
                  min={0}
                  value={adjustExactCount}
                  onChange={(e) => setAdjustExactCount(e.target.value)}
                  placeholder="Count on shelf..."
                  className="w-full font-mono text-base font-bold px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Delta adjustment: <strong>{(Number(adjustExactCount) || 0) - adjustModalItem.stockQty >= 0 ? `+${(Number(adjustExactCount) || 0) - adjustModalItem.stockQty}` : (Number(adjustExactCount) || 0) - adjustModalItem.stockQty}</strong> units
                </span>
              </div>
            )}

            {/* Reason Input & Preset Chips */}
            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase block mb-1">
                Reason / Note
              </label>
              <input
                type="text"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="Reason for adjustment"
                className="w-full text-xs font-medium px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white mb-2"
              />
              <div className="flex flex-wrap gap-1">
                {[
                  "Inventory audit count",
                  "Damaged / Broken",
                  "Expired / Spoilage",
                  "Supplier discrepancy",
                  "Internal transfer",
                ].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setAdjustReason(chip)}
                    className="px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[10px] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAdjustModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const finalDelta = adjustMode === "delta"
                    ? adjustDelta
                    : (Number(adjustExactCount) || 0) - adjustModalItem.stockQty;
                  if (finalDelta === 0) {
                    alert("Change is 0, no stock adjustment needed.");
                    return;
                  }
                  handleAdjustStockCustom(adjustModalItem.id, finalDelta, adjustReason);
                }}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-sm"
              >
                Save Adjustment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Record Purchase Order */}
      {isPurchaseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in overflow-y-auto">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-emerald-600" />
                <span>Record Purchase &amp; Supplier Delivery</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsPurchaseModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Enter incoming stock invoice. Stock on hand and cost will update automatically upon confirmation.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase block mb-1">
                  Supplier / Vendor Name
                </label>
                <input
                  type="text"
                  value={purchaseSupplier}
                  onChange={(e) => setPurchaseSupplier(e.target.value)}
                  placeholder="e.g. Karma Wholesale / Centenary Market"
                  className="w-full text-xs font-medium px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white mb-1.5"
                />
                <div className="flex flex-wrap gap-1">
                  {["Karma Wholesale", "Centenary Market", "Druk Distributors", "Local Vendor"].map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setPurchaseSupplier(name)}
                      className="px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[10px] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase block mb-1">
                  Invoice # / Reference Note
                </label>
                <input
                  type="text"
                  value={purchaseNote}
                  onChange={(e) => setPurchaseNote(e.target.value)}
                  placeholder="e.g. Bill #8491 / Weekly drinks restock"
                  className="w-full text-xs font-medium px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              {/* Purchase Line Items */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                    Delivered Items ({purchaseLines.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const firstItem = stockItems[0] || menu[0];
                      setPurchaseLines([
                        ...purchaseLines,
                        { itemId: firstItem ? firstItem.id : 0, qty: 12, unitCostNu: firstItem ? firstItem.costNu || 20 : 20 },
                      ]);
                    }}
                    className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 hover:underline"
                  >
                    <Plus className="h-3 w-3" /> Add Item Line
                  </button>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {purchaseLines.map((line, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <select
                          value={line.itemId}
                          onChange={(e) => {
                            const newId = Number(e.target.value);
                            const found = menu.find((m) => m.id === newId);
                            const updated = [...purchaseLines];
                            updated[idx] = {
                              ...line,
                              itemId: newId,
                              unitCostNu: found?.costNu || line.unitCostNu || 20,
                            };
                            setPurchaseLines(updated);
                          }}
                          className="flex-1 text-xs font-bold px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                        >
                          {menu.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name} ({m.category} • sell Nu. {m.priceNu})
                            </option>
                          ))}
                        </select>
                        {purchaseLines.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              setPurchaseLines(purchaseLines.filter((_, i) => i !== idx));
                            }}
                            className="p-1 rounded-lg hover:bg-rose-100 text-rose-500"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-2 items-center">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-semibold">Qty (Units)</span>
                          <input
                            type="number"
                            min={1}
                            value={line.qty}
                            onChange={(e) => {
                              const updated = [...purchaseLines];
                              updated[idx] = { ...line, qty: Number(e.target.value) || 0 };
                              setPurchaseLines(updated);
                            }}
                            className="w-full font-mono text-xs font-bold px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                          />
                        </div>

                        <div>
                          <span className="text-[10px] text-slate-400 block font-semibold">Unit Cost (Nu.)</span>
                          <input
                            type="number"
                            min={0}
                            value={line.unitCostNu}
                            onChange={(e) => {
                              const updated = [...purchaseLines];
                              updated[idx] = { ...line, unitCostNu: Number(e.target.value) || 0 };
                              setPurchaseLines(updated);
                            }}
                            className="w-full font-mono text-xs font-bold px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                          />
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block font-semibold">Line Total</span>
                          <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
                            Nu. {line.qty * line.unitCostNu}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Total Cost Banner */}
                <div className="mt-3 p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300 block">
                      Total Invoice Amount
                    </span>
                    <span className="text-[11px] text-emerald-700 dark:text-emerald-400">
                      {purchaseLines.reduce((sum, l) => sum + l.qty, 0)} total units
                    </span>
                  </div>
                  <span className="font-mono font-black text-xl text-emerald-700 dark:text-emerald-300">
                    Nu. {purchaseLines.reduce((sum, l) => sum + l.qty * l.unitCostNu, 0)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPurchaseModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleSavePurchase(purchaseSupplier, purchaseNote, purchaseLines)}
                  disabled={saving || !purchaseSupplier.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50"
                >
                  Receive into Stock
                </button>
              </div>
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

export default function V2AdminDashboard() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-medium text-sm">
            <RefreshCw className="h-5 w-5 animate-spin text-emerald-500" />
            <span>Loading Admin Command Center...</span>
          </div>
        </div>
      }
    >
      <AdminDashboardInner />
    </Suspense>
  );
}
