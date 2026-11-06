"use client";

import { useEffect, useState } from "react";
import { useV2Store } from "@/lib/v2/store";
import type { VisitView } from "@/lib/types";
import { TopBar } from "@/components/v2/TopBar";
import { AdmissionView } from "@/components/v2/AdmissionView";
import { FloorRadar } from "@/components/v2/FloorRadar";
import { OrderView } from "@/components/v2/OrderView";
import { CheckoutModal } from "@/components/v2/CheckoutModal";
import { StaffDeviceSetupModal } from "@/components/v2/StaffDeviceSetupModal";
import { LiveAuditDrawer } from "@/components/v2/LiveAuditDrawer";
import { AdminHubModal } from "@/components/v2/AdminHubModal";
import { CounterPrintBridge } from "@/components/v2/CounterPrintBridge";
import { Users, Clock, Utensils, LayoutDashboard, Plus } from "lucide-react";

export default function V2HandheldPos() {
  const staff = useV2Store((s) => s.staff);
  const setStaff = useV2Store((s) => s.setStaff);
  const visits = useV2Store((s) => s.visits);
  const bootstrap = useV2Store((s) => s.bootstrap);
  const initRealtime = useV2Store((s) => s.initRealtime);
  const [sessionIsAdmin, setSessionIsAdmin] = useState(false);
  // Login session only — device name pick must never unlock Admin Hub / Owner menu.
  const isAdmin = sessionIsAdmin;

  const [activeTab, setActiveTab] = useState<"admit" | "radar" | "order" | "admin">("radar");
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [isAuditDrawerOpen, setIsAuditDrawerOpen] = useState(false);
  const [isAdminHubOpen, setIsAdminHubOpen] = useState(false);

  const [selectedVisitForOrder, setSelectedVisitForOrder] = useState<VisitView | null>(null);
  const [selectedVisitForCheckout, setSelectedVisitForCheckout] = useState<VisitView | null>(null);
  const [showDesktopAdmit, setShowDesktopAdmit] = useState(false);

  useEffect(() => {
    bootstrap();
    const unsub = initRealtime();
    return () => unsub();
  }, [bootstrap, initRealtime]);

  // Sync PIN-login session role into client store (source of truth for Admin menu).
  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (!alive) return;
        const session = data?.session as
          | { staffId?: number; name?: string; role?: string }
          | null
          | undefined;
        const role = session?.role || "";
        setSessionIsAdmin(role === "admin");
        if (session?.name && role) {
          const current = useV2Store.getState().staff;
          setStaff({
            staffId: session.staffId ?? current?.staffId,
            staffName: session.name,
            role,
            deviceLabel: current?.deviceLabel || "Active Station",
            deviceId: current?.deviceId || "STATION-SYNC",
          });
        }
        if (role && role !== "admin") {
          setIsAdminHubOpen(false);
          setActiveTab((tab) => (tab === "admin" ? "radar" : tab));
        }
      })
      .catch(() => {
        if (alive) setSessionIsAdmin(false);
      });
    return () => {
      alive = false;
    };
  }, [setStaff]);

  // Prompt staff setup if not configured
  useEffect(() => {
    if (!staff && typeof window !== "undefined") {
      const timer = setTimeout(() => setIsStaffModalOpen(true), 600);
      return () => clearTimeout(timer);
    }
  }, [staff]);

  const activeVisitsCount = visits.filter((v) => v.status === "open").length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans select-none antialiased">
      {/* Top Header Bar */}
      <TopBar
        onOpenStaffModal={() => setIsStaffModalOpen(true)}
        onOpenAudit={() => setIsAuditDrawerOpen(true)}
        onOpenAdmin={() => {
          if (isAdmin) setIsAdminHubOpen(true);
        }}
      />

      {/* Embedded Counter Print & Audio Bridge */}
      <CounterPrintBridge />

      {/* DESKTOP PANORAMIC COUNTER STATION (>= 768px / md:) */}
      <div className="hidden md:flex flex-1 max-w-7xl w-full mx-auto p-4 gap-6 items-start">
        {/* Left Column: Floor Radar & Admission */}
        <div className="w-[45%] space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="font-extrabold text-lg text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <span>Floor Radar ({activeVisitsCount})</span>
            </h2>
            <button
              type="button"
              onClick={() => setShowDesktopAdmit(!showDesktopAdmit)}
              className="py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
            >
              <Plus className="h-4 w-4" />
              <span>{showDesktopAdmit ? "Close Form" : "New Admission"}</span>
            </button>
          </div>

          {showDesktopAdmit && (
            <div className="rounded-3xl border border-emerald-500/30 bg-emerald-50/20 dark:bg-emerald-950/20 p-2 animate-in fade-in duration-200">
              <AdmissionView onSuccess={() => setShowDesktopAdmit(false)} />
            </div>
          )}

          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm overflow-hidden shadow-sm">
            <FloorRadar
              onSelectForOrder={(v) => setSelectedVisitForOrder(v)}
              onSelectForCheckout={(v) => setSelectedVisitForCheckout(v)}
            />
          </div>
        </div>

        {/* Right Column: Menu Catalog & KOT Cart */}
        <div className="w-[55%] space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="font-extrabold text-lg text-slate-900 dark:text-white flex items-center gap-2">
              <Utensils className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <span>Food & Drink Orders (KOT / BOT)</span>
            </h2>
          </div>

          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm overflow-hidden shadow-sm">
            <OrderView
              targetVisit={selectedVisitForOrder}
              onClearTargetVisit={() => setSelectedVisitForOrder(null)}
              onOrderSent={() => setSelectedVisitForOrder(null)}
            />
          </div>
        </div>
      </div>

      {/* MOBILE THUMB COCKPIT VIEW (< 768px / md:hidden) */}
      <main className="md:hidden flex-1 pb-20">
        {activeTab === "admit" && (
          <AdmissionView
            onSuccess={() => {
              setActiveTab("radar");
            }}
          />
        )}

        {activeTab === "radar" && (
          <FloorRadar
            onSelectForOrder={(v) => {
              setSelectedVisitForOrder(v);
              setActiveTab("order");
            }}
            onSelectForCheckout={(v) => {
              setSelectedVisitForCheckout(v);
            }}
          />
        )}

        {activeTab === "order" && (
          <OrderView
            targetVisit={selectedVisitForOrder}
            onClearTargetVisit={() => setSelectedVisitForOrder(null)}
            onOrderSent={() => {
              setSelectedVisitForOrder(null);
              setActiveTab("radar");
            }}
          />
        )}

        {activeTab === "admin" && isAdmin && (
          <div className="p-3 sm:p-4">
            <AdminHubModal
              isOpen={true}
              onClose={() => setActiveTab("radar")}
            />
          </div>
        )}
      </main>

      {/* MOBILE BOTTOM NAVIGATION (< 768px) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-2 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] transition-colors">
        <div className={`max-w-lg mx-auto grid gap-1 ${isAdmin ? "grid-cols-4" : "grid-cols-3"}`}>
          {/* Radar (Floor View) */}
          <button
            type="button"
            onClick={() => setActiveTab("radar")}
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all ${
              activeTab === "radar"
                ? "text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 font-medium"
            }`}
          >
            <div className="relative">
              <Clock className="h-5 w-5" />
              {activeVisitsCount > 0 && (
                <span className="absolute -top-1 -right-2 h-4 min-w-4 px-1 rounded-full bg-emerald-600 text-white text-[9px] font-black flex items-center justify-center">
                  {activeVisitsCount}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-1">Radar</span>
          </button>

          {/* Admit (Pass & Wristband) */}
          <button
            type="button"
            onClick={() => setActiveTab("admit")}
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all ${
              activeTab === "admit"
                ? "text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 font-medium"
            }`}
          >
            <Users className="h-5 w-5" />
            <span className="text-[10px] mt-1">Admit</span>
          </button>

          {/* Food / KOT Orders */}
          <button
            type="button"
            onClick={() => setActiveTab("order")}
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all ${
              activeTab === "order"
                ? "text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 font-medium"
            }`}
          >
            <Utensils className="h-5 w-5" />
            <span className="text-[10px] mt-1">Food / KOT</span>
          </button>

          {/* Admin Hub — admin role only */}
          {isAdmin ? (
            <button
              type="button"
              onClick={() => setIsAdminHubOpen(true)}
              className="flex flex-col items-center justify-center py-1.5 px-1 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-700 font-medium transition-all"
            >
              <LayoutDashboard className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              <span className="text-[10px] mt-1">Admin</span>
            </button>
          ) : null}
        </div>
      </nav>

      {/* Modals & Slide-over Drawers */}
      <StaffDeviceSetupModal
        isOpen={isStaffModalOpen}
        onClose={() => setIsStaffModalOpen(false)}
      />

      <CheckoutModal
        visit={selectedVisitForCheckout}
        onClose={() => setSelectedVisitForCheckout(null)}
        onSettled={() => {
          setSelectedVisitForCheckout(null);
          setActiveTab("radar");
        }}
      />

      <LiveAuditDrawer
        isOpen={isAuditDrawerOpen}
        onClose={() => setIsAuditDrawerOpen(false)}
      />

      {isAdmin ? (
        <AdminHubModal
          isOpen={isAdminHubOpen}
          onClose={() => setIsAdminHubOpen(false)}
        />
      ) : null}
    </div>
  );
}
