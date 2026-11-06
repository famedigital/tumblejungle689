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
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
          Ticket / Table
        </p>
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
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => {
            setSelectedVisitId(null);
            setTableNo("Cafe");
            onClearTargetVisit?.();
          }}
          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
            !selectedVisitId && tableNo.toLowerCase().includes("cafe")
              ? "border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
          }`}
        >
          Walk-in Cafe
        </button>
        <button
          type="button"
          onClick={() => {
            setSelectedVisitId(null);
            setTableNo("Restaurant");
            onClearTargetVisit?.();
          }}
          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
            !selectedVisitId && tableNo.toLowerCase().includes("rest")
              ? "border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
          }`}
        >
          Walk-in Restaurant
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <select
          value={selectedVisitId ?? ""}
          onChange={(e) => {
            const val = e.target.value ? Number(e.target.value) : null;
            setSelectedVisitId(val);
            const found = visits.find((v) => v.id === val);
            if (found?.tableNo) setTableNo(found.tableNo);
          }}
          className="w-full text-sm font-medium px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
        >
          <option value="">Walk-in / new tab</option>
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
          placeholder="Table (T-3, Cafe…)"
          value={tableNo}
          onChange={(e) => setTableNo(e.target.value)}
          className="w-full text-sm font-medium px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
        />
      </div>
      <input
        type="text"
        placeholder="Kitchen note (optional)"
        value={orderNotes}
        onChange={(e) => setOrderNotes(e.target.value)}
        className="w-full text-sm px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/70 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
      />
      {selectedVisit ? (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Sending to <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedVisit.code}</span>
          {tableNo ? <> · table <span className="font-semibold">{tableNo}</span></> : null}
        </p>
      ) : (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          No pass selected — creates a cafe / restaurant walk-in tab.
        </p>
      )}
    </div>
  );

  const sendButton = (
    <button
      type="button"
      onClick={handleSendKot}
      disabled={isSubmitting || cart.length === 0}
      className="w-full py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 text-white shadow-sm active:scale-[0.985] transition-all disabled:opacity-45 disabled:pointer-events-none"
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
    <ul className="space-y-2 pr-0.5">
      {cart.length === 0 ? (
        <li className="rounded-xl border border-dashed border-violet-200 dark:border-violet-900/50 px-3 py-8 text-center text-xs text-slate-500 dark:text-slate-400">
          Tap items to build the ticket.
        </li>
      ) : (
        cart.map((line) => (
          <li
            key={line.item.id}
            className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 bg-white dark:bg-slate-900 ${
              (line.item.outlet || "cafe") === "cafe"
                ? "border-amber-200/80 dark:border-amber-900/50"
                : "border-violet-200/80 dark:border-violet-900/50"
            }`}
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
        <div className="pointer-events-none fixed top-16 left-1/2 z-[80] -translate-x-1/2 px-3 w-[min(92vw,28rem)]">
          <div
            className={`pointer-events-auto rounded-2xl border px-4 py-3 shadow-xl backdrop-blur-md flex items-center gap-2.5 ${
              toast.tone === "print"
                ? "border-violet-300 bg-violet-600 text-white dark:border-violet-500"
                : "border-emerald-300 bg-emerald-600 text-white dark:border-emerald-500"
            }`}
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
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40 text-slate-900 dark:text-white"
            />
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap capitalize transition-colors ${
                  selectedCategory === cat
                    ? "bg-violet-600 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-700"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-28 md:pb-3">
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-2 sm:gap-2.5">
            {filteredMenu.map((item) => {
              const inCart = cart.find((c) => c.item.id === item.id);
              const isCafe = (item.outlet || "cafe") === "cafe";
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => addToCart(item, 1)}
                  className={`text-left rounded-2xl border p-3 transition-all active:scale-[0.985] ${
                    inCart
                      ? isCafe
                        ? "bg-amber-50 dark:bg-amber-950/30 border-amber-400/50 ring-1 ring-amber-500/25 shadow-[inset_3px_0_0_0_rgb(245,158,11)]"
                        : "bg-violet-50 dark:bg-violet-950/30 border-violet-400/50 ring-1 ring-violet-500/25 shadow-[inset_3px_0_0_0_rgb(139,92,246)]"
                      : isCafe
                        ? "bg-gradient-to-br from-amber-50/80 to-white dark:from-amber-950/20 dark:to-slate-900 border-amber-200/70 dark:border-amber-900/40 hover:border-amber-400/50 hover:shadow-sm"
                        : "bg-gradient-to-br from-violet-50/80 to-white dark:from-violet-950/20 dark:to-slate-900 border-violet-200/70 dark:border-violet-900/40 hover:border-violet-400/50 hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p
                        className={`text-[9px] font-bold uppercase tracking-wider mb-0.5 ${
                          isCafe ? "text-amber-700 dark:text-amber-400" : "text-violet-700 dark:text-violet-400"
                        }`}
                      >
                        {isCafe ? "Cafe" : "Restaurant"}
                      </p>
                      <h3 className="font-semibold text-sm text-slate-900 dark:text-white line-clamp-2 leading-snug">
                        {item.name}
                      </h3>
                    </div>
                    {inCart ? (
                      <span
                        className={`shrink-0 h-6 min-w-6 px-1.5 rounded-full text-white text-[11px] font-bold flex items-center justify-center ${
                          isCafe ? "bg-amber-500" : "bg-violet-600"
                        }`}
                      >
                        {inCart.qty}
                      </span>
                    ) : null}
                  </div>
                  <p
                    className={`mt-2 text-sm font-mono font-bold ${
                      isCafe ? "text-amber-800 dark:text-amber-300" : "text-violet-800 dark:text-violet-300"
                    }`}
                  >
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

      {/* Desktop ticket rail — fixed height, cart scrolls inside */}
      <aside className="hidden md:flex w-[280px] xl:w-[300px] shrink-0 flex-col border-l border-violet-200/60 dark:border-violet-900/40 bg-gradient-to-b from-violet-50/50 to-slate-50/80 dark:from-violet-950/20 dark:to-slate-950/40 p-4 gap-3 min-h-0 overflow-hidden">
        <div className="shrink-0 space-y-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-700 dark:text-violet-400">
              Order ticket
            </p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white">
              {cartTotalQty} item{cartTotalQty === 1 ? "" : "s"} · Nu. {cartTotalNu}
            </p>
          </div>
          {targetControls}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{cartLines}</div>

        <div className="shrink-0 space-y-2 pt-1 border-t border-violet-200/70 dark:border-violet-900/50">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500 dark:text-slate-400">Total</span>
            <span className="font-mono font-bold text-slate-900 dark:text-white">Nu. {cartTotalNu}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={clearCart}
              disabled={cart.length === 0}
              className="h-11 w-11 shrink-0 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600 hover:border-rose-300 disabled:opacity-40 flex items-center justify-center"
              title="Clear"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <div className="flex-1">{sendButton}</div>
          </div>
        </div>
      </aside>

      {cart.length > 0 ? (
        <div className="md:hidden sticky bottom-0 z-20 -mx-0 mt-auto border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">{cartTotalQty} selected</span>
            <div className="flex items-center gap-3">
              <span className="text-base font-black font-mono text-violet-700 dark:text-violet-400">
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
