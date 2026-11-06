"use client";

import { useEffect, useState } from "react";
import { useV2Store } from "@/lib/v2/store";
import type { Outlet, VisitView } from "@/lib/types";
import { KotSlip } from "@/components/kot-slip";
import { PrintPortal } from "@/components/print-portal";
import { thermalPrint } from "@/lib/print-station";
import { forceLocalPrintDialog } from "@/lib/v2/print-local";
import { Plus, Minus, Send, Check, Search, Trash2 } from "lucide-react";

type KotPrintPack = {
  code: string;
  tableNo: string;
  phone: string;
  orderedAt: string;
  staff: string;
  lines: { name: string; qty: number; outlet: Outlet; note: string }[];
};

export function OrderView({
  targetVisit,
  onClearTargetVisit,
  onOrderSent,
}: {
  targetVisit?: VisitView | null;
  onClearTargetVisit?: () => void;
  onOrderSent?: () => void;
}) {
  const menu = useV2Store((s) => s.menu);
  const visits = useV2Store((s) => s.visits);
  const cart = useV2Store((s) => s.cart);
  const addToCart = useV2Store((s) => s.addToCart);
  const updateCartQty = useV2Store((s) => s.updateCartQty);
  const clearCart = useV2Store((s) => s.clearCart);
  const sendKot = useV2Store((s) => s.sendKot);
  const venueName = useV2Store((s) => s.venueName);
  const staff = useV2Store((s) => s.staff);

  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [manualVisitId, setManualVisitId] = useState<number | null>(null);
  const [clearedTarget, setClearedTarget] = useState(false);
  const [manualTableNo, setManualTableNo] = useState("");
  const [boundTargetId, setBoundTargetId] = useState<number | null>(targetVisit?.id ?? null);
  const [orderNotes, setOrderNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);
  const [toast, setToast] = useState<{ tone: "ok" | "print"; text: string } | null>(null);
  const [kotPrint, setKotPrint] = useState<KotPrintPack | null>(null);

  const incomingTargetId = targetVisit?.id ?? null;
  if (incomingTargetId !== boundTargetId) {
    setBoundTargetId(incomingTargetId);
    if (incomingTargetId != null) {
      setClearedTarget(false);
      setManualVisitId(null);
      setManualTableNo("");
    }
  }

  const selectedVisitId =
    !clearedTarget && targetVisit ? targetVisit.id : manualVisitId;
  const tableNo =
    !clearedTarget && targetVisit?.tableNo && !manualTableNo
      ? targetVisit.tableNo
      : manualTableNo || (!clearedTarget ? targetVisit?.tableNo || "" : "");
  const setSelectedVisitId = (id: number | null) => {
    setClearedTarget(true);
    setManualVisitId(id);
  };
  const setTableNo = (value: string) => {
    setClearedTarget(true);
    setManualTableNo(value);
  };

  const categories = ["all", ...new Set(menu.map((m) => m.category || "General"))];

  const filteredMenu = menu.filter((item) => {
    if (!item.active) return false;
    if (selectedCategory !== "all" && item.category !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        (item.category && item.category.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const cartTotalNu = cart.reduce((sum, c) => sum + c.qty * c.item.priceNu, 0);
  const cartTotalQty = cart.reduce((sum, c) => sum + c.qty, 0);
  const selectedVisit = visits.find((v) => v.id === selectedVisitId) || targetVisit || null;

  const handleSendKot = async () => {
    if (cart.length === 0) return;
    setIsSubmitting(true);

    const note = orderNotes.trim();
    const snapshot: KotPrintPack = {
      code: selectedVisit?.code || tableNo.trim() || "WALK-IN",
      tableNo: tableNo.trim() || selectedVisit?.tableNo || "Floor",
      phone: selectedVisit?.phone || "",
      orderedAt: new Date().toISOString(),
      staff: staff?.staffName || "",
      lines: cart.map((c) => ({
        name: c.item.name,
        qty: c.qty,
        outlet: (c.item.outlet || "cafe") as Outlet,
        note,
      })),
    };

    const res = await sendKot({
      visitId: selectedVisitId || undefined,
      tableNo: tableNo.trim() || undefined,
      notes: note || undefined,
    });

    setIsSubmitting(false);

    if (res.ok) {
      setKotPrint(snapshot);
      setSentSuccess(true);
      setToast({ tone: "ok", text: `KOT sent · ${snapshot.code} · ${snapshot.lines.reduce((n, l) => n + l.qty, 0)} items` });
      window.setTimeout(() => setSentSuccess(false), 2200);
      window.setTimeout(() => onOrderSent?.(), 900);
    } else {
      alert(res.error || "Failed to send order.");
    }
  };

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // Open system print dialog once KotSlip is mounted in the portal.
  useEffect(() => {
    if (!kotPrint) return;
    const pack = kotPrint;
    const toastTimer = window.setTimeout(() => {
      setToast({ tone: "print", text: `Printing KOT · ${pack.code} · table ${pack.tableNo}` });
    }, 0);
    const timer = window.setTimeout(() => {
      void thermalPrint("kot", { forceBrowser: forceLocalPrintDialog() })
        .catch((err) => console.warn("KOT print:", err))
        .finally(() => {
          window.setTimeout(() => setKotPrint(null), 800);
        });
    }, 280);
    return () => {
      window.clearTimeout(toastTimer);
      window.clearTimeout(timer);
    };
  }, [kotPrint]);

  const targetControls = (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Ticket</p>
        {targetVisit && !clearedTarget ? (
          <button
            type="button"
            onClick={() => {
              setClearedTarget(true);
              setManualVisitId(null);
              setManualTableNo("");
              onClearTargetVisit?.();
            }}
            className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400"
          >
            Clear
          </button>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={() => {
            setSelectedVisitId(null);
            setTableNo("Cafe");
            onClearTargetVisit?.();
          }}
          className={`px-2 py-1.5 rounded-lg text-[11px] font-bold border ${
            !selectedVisitId && tableNo.toLowerCase().includes("cafe")
              ? "border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
          }`}
        >
          Cafe
        </button>
        <button
          type="button"
          onClick={() => {
            setSelectedVisitId(null);
            setTableNo("Restaurant");
            onClearTargetVisit?.();
          }}
          className={`px-2 py-1.5 rounded-lg text-[11px] font-bold border ${
            !selectedVisitId && tableNo.toLowerCase().includes("rest")
              ? "border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
          }`}
        >
          Restaurant
        </button>
      </div>
      <select
        value={selectedVisitId ?? ""}
        onChange={(e) => {
          const val = e.target.value ? Number(e.target.value) : null;
          setSelectedVisitId(val);
          const found = visits.find((v) => v.id === val);
          if (found?.tableNo) setTableNo(found.tableNo);
        }}
        className="w-full appearance-none text-sm font-medium pl-3 pr-9 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 bg-[length:1rem] bg-[right_0.65rem_center] bg-no-repeat"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
        }}
      >
        <option value="">Walk-in</option>
        {visits
          .filter((v) => v.status === "open")
          .map((v) => (
            <option key={v.id} value={v.id}>
              {v.code} · {v.guardianName || "Guest"}
            </option>
          ))}
      </select>
      <input
        type="text"
        placeholder="Table"
        value={tableNo}
        onChange={(e) => setTableNo(e.target.value)}
        className="w-full text-sm font-medium px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
      />
      <input
        type="text"
        placeholder="Kitchen note"
        value={orderNotes}
        onChange={(e) => setOrderNotes(e.target.value)}
        className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
      />
      <p className="text-[10px] text-slate-500 truncate">
        {selectedVisit
          ? `To ${selectedVisit.code}${tableNo ? ` · ${tableNo}` : ""}`
          : "Walk-in tab"}
      </p>
    </div>
  );

  const sendButton = (
    <button
      type="button"
      onClick={handleSendKot}
      disabled={isSubmitting || cart.length === 0}
      className="w-full py-2.5 px-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm active:scale-[0.985] disabled:opacity-45 disabled:pointer-events-none"
    >
      {sentSuccess ? (
        <>
          <Check className="h-4 w-4" />
          <span>Sent to kitchen</span>
        </>
      ) : isSubmitting ? (
        <span>Sending…</span>
      ) : (
        <>
          <Send className="h-4 w-4" />
          <span>Send KOT</span>
        </>
      )}
    </button>
  );

  const cartLines = (
    <ul className="space-y-1.5 pr-0.5">
      {cart.length === 0 ? (
        <li className="rounded-lg border border-dashed border-slate-200 dark:border-slate-700 px-3 py-6 text-center text-xs text-slate-500">
          Tap menu items
        </li>
      ) : (
        cart.map((line) => (
          <li
            key={line.item.id}
            className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800 px-2 py-1.5 bg-white dark:bg-slate-900"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{line.item.name}</p>
              <p className="text-[11px] font-mono text-slate-500">Nu. {line.item.priceNu}</p>
            </div>
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5">
              <button
                type="button"
                onClick={() => updateCartQty(line.item.id, -1)}
                className="h-7 w-7 rounded-md flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-6 text-center text-sm font-bold tabular-nums">{line.qty}</span>
              <button
                type="button"
                onClick={() => updateCartQty(line.item.id, 1)}
                className="h-7 w-7 rounded-md flex items-center justify-center bg-emerald-600 text-white hover:bg-emerald-500"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </li>
        ))
      )}
    </ul>
  );

  return (
    <div className="h-full min-h-0 overflow-hidden flex flex-col md:flex-row md:gap-0 relative">
      {/* Fixed viewport toast — never requires scrolling */}
      {toast ? (
        <div className="pointer-events-none fixed top-14 left-1/2 z-[80] -translate-x-1/2 px-3 w-[min(92vw,24rem)]">
          <div
            className="pointer-events-auto rounded-xl border border-emerald-500/40 bg-emerald-600 text-white px-3 py-2.5 shadow-lg flex items-center gap-2"
            role="status"
          >
            <Check className="h-4 w-4 shrink-0" />
            <p className="text-sm font-bold leading-snug">{toast.text}</p>
          </div>
        </div>
      ) : null}

      {/* Catalog column — ONLY this grid scrolls on desktop */}
      <div className="min-h-0 flex-1 flex flex-col p-3 sm:p-4 md:p-4 md:pr-3 space-y-2.5 overflow-hidden">
        <div className="md:hidden shrink-0">{targetControls}</div>

        <div className="space-y-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search menu…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 text-slate-900 dark:text-white"
            />
          </div>
          <div className="till-scroll flex items-center gap-1 overflow-x-auto pb-0.5">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap capitalize ${
                  selectedCategory === cat
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="till-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain pb-28 md:pb-2">
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-2">
            {filteredMenu.map((item) => {
              const inCart = cart.find((c) => c.item.id === item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => addToCart(item, 1)}
                  className={`text-left rounded-lg border p-2.5 transition active:scale-[0.985] hover:-translate-y-0.5 hover:shadow-md ${
                    inCart
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 shadow-sm"
                      : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <h3 className="font-semibold text-sm text-slate-900 dark:text-white line-clamp-2 leading-snug">
                      {item.name}
                    </h3>
                    {inCart ? (
                      <span className="shrink-0 h-5 min-w-5 px-1 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center">
                        {inCart.qty}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1.5 text-sm font-mono font-bold text-slate-800 dark:text-slate-100">
                    Nu. {item.priceNu}
                  </p>
                </button>
              );
            })}
          </div>
          {filteredMenu.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">No items in this category.</p>
          ) : null}
        </div>
      </div>

      <aside className="hidden md:flex w-[260px] xl:w-[280px] shrink-0 flex-col border-l border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-3 gap-2.5 min-h-0 overflow-hidden">
        <div className="shrink-0 space-y-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Ticket</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              {cartTotalQty} · Nu. {cartTotalNu}
            </p>
          </div>
          {targetControls}
        </div>

        <div className="till-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">{cartLines}</div>

        <div className="shrink-0 space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={clearCart}
              disabled={cart.length === 0}
              className="h-10 w-10 shrink-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 hover:text-rose-600 disabled:opacity-40 flex items-center justify-center"
              title="Clear"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <div className="flex-1">{sendButton}</div>
          </div>
        </div>
      </aside>

      {cart.length > 0 ? (
        <div className="md:hidden sticky bottom-0 z-20 mt-auto border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">{cartTotalQty} selected</span>
            <div className="flex items-center gap-3">
              <span className="text-base font-black font-mono text-emerald-700 dark:text-emerald-400">
                Nu. {cartTotalNu}
              </span>
              <button type="button" onClick={clearCart} className="p-1 text-slate-400 hover:text-rose-500">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
          {sendButton}
        </div>
      ) : null}

      {kotPrint ? (
        <PrintPortal>
          <KotSlip
            venue={venueName || "Tumble Jungle"}
            tableNo={kotPrint.tableNo}
            phone={kotPrint.phone}
            code={kotPrint.code}
            orderedAt={kotPrint.orderedAt}
            staff={kotPrint.staff}
            reprint={false}
            ticket="kot"
            lines={kotPrint.lines}
          />
        </PrintPortal>
      ) : null}
    </div>
  );
}
