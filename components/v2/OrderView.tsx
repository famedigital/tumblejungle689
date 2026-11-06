"use client";

import { useState } from "react";
import { useV2Store } from "@/lib/v2/store";
import type { VisitView } from "@/lib/types";
import { Plus, Minus, Send, Check, Search, Trash2 } from "lucide-react";

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

  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVisitId, setSelectedVisitId] = useState<number | null>(
    targetVisit?.id || null
  );
  const [tableNo, setTableNo] = useState(targetVisit?.tableNo || "");
  const [orderNotes, setOrderNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);

  // Derive unique categories
  const categories = ["all", ...new Set(menu.map((m) => m.category || "General"))];

  // Filter menu
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

  const cartTotalNu = cart.reduce(
    (sum, c) => sum + c.qty * c.item.priceNu,
    0
  );
  const cartTotalQty = cart.reduce((sum, c) => sum + c.qty, 0);

  const handleSendKot = async () => {
    if (cart.length === 0) return;
    setIsSubmitting(true);

    const res = await sendKot({
      visitId: selectedVisitId || undefined,
      tableNo: tableNo.trim() || undefined,
      notes: orderNotes.trim() || undefined,
    });

    setIsSubmitting(false);

    if (res.ok) {
      setSentSuccess(true);
      setTimeout(() => {
        setSentSuccess(false);
        onOrderSent?.();
      }, 1200);
    } else {
      alert(res.error || "Failed to send order.");
    }
  };

  return (
    <div className="max-w-lg mx-auto p-4 pb-28 space-y-4">
      {/* Target Selector Banner */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 shadow-sm space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          <span>Assign Order To:</span>
          {targetVisit && (
            <button
              type="button"
              onClick={onClearTargetVisit}
              className="text-emerald-600 dark:text-emerald-400 font-medium normal-case text-xs"
            >
              Clear Selected
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {/* Active Visit Dropdown */}
          <select
            value={selectedVisitId ?? ""}
            onChange={(e) => {
              const val = e.target.value ? Number(e.target.value) : null;
              setSelectedVisitId(val);
              const found = visits.find((v) => v.id === val);
              if (found?.tableNo) setTableNo(found.tableNo);
            }}
            className="w-full text-xs font-medium px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
          >
            <option value="">(Select Play Pass)</option>
            {visits
              .filter((v) => v.status === "open")
              .map((v) => (
                <option key={v.id} value={v.id}>
                  {v.code} - {v.guardianName || "Child"}
                </option>
              ))}
          </select>

          {/* Or Table No. input */}
          <input
            type="text"
            placeholder="Table # (e.g. T-3)"
            value={tableNo}
            onChange={(e) => setTableNo(e.target.value)}
            className="w-full text-xs font-medium px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
          />
        </div>

        {/* Optional note input */}
        <input
          type="text"
          placeholder="Special notes (e.g. less spicy, no onion)"
          value={orderNotes}
          onChange={(e) => setOrderNotes(e.target.value)}
          className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-900 dark:text-white"
        />
      </div>

      {/* Search & Category Pills */}
      <div className="space-y-2.5">
        <div className="relative">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search food, drinks, snacks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm text-slate-900 dark:text-white"
          />
        </div>

        {/* Categories scroll row */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all capitalize ${
                selectedCategory === cat
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Menu Items Grid */}
      <div className="grid grid-cols-2 gap-2.5">
        {filteredMenu.map((item) => {
          const inCart = cart.find((c) => c.item.id === item.id);
          return (
            <div
              key={item.id}
              className={`rounded-2xl border p-3 flex flex-col justify-between transition-all shadow-sm ${
                inCart
                  ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500/50 ring-1 ring-emerald-500/30"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
              }`}
            >
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1">
                  {item.name}
                </h3>
                <span className="text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                  Nu. {item.priceNu}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between">
                {inCart ? (
                  <div className="flex items-center gap-2 w-full justify-between bg-white dark:bg-slate-800 rounded-xl p-1 border border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => updateCartQty(item.id, -1)}
                      className="h-7 w-7 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-800 dark:text-slate-200 flex items-center justify-center font-bold text-sm"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                      {inCart.qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateCartQty(item.id, 1)}
                      className="h-7 w-7 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 flex items-center justify-center font-bold text-sm"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => addToCart(item, 1)}
                    className="w-full py-1.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating Sticky Bottom Cart Action */}
      {cart.length > 0 && (
        <div className="fixed bottom-16 left-0 right-0 p-3 z-30">
          <div className="max-w-lg mx-auto rounded-2xl bg-slate-900/95 dark:bg-slate-950/95 text-white p-3.5 shadow-2xl backdrop-blur-md border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">
                {cartTotalQty} item(s) selected
              </span>
              <div className="flex items-center gap-3">
                <span className="text-base font-black font-mono text-emerald-400">
                  Nu. {cartTotalNu}
                </span>
                <button
                  type="button"
                  onClick={clearCart}
                  title="Clear Cart"
                  className="p-1 rounded text-slate-400 hover:text-rose-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSendKot}
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {sentSuccess ? (
                <>
                  <Check className="h-4 w-4 text-white" />
                  <span>KOT Spooled & Printed!</span>
                </>
              ) : isSubmitting ? (
                <span>Sending to Kitchen...</span>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span>SEND KOT & STAY ON FLOOR</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
