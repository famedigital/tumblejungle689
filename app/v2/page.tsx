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
import { RecentDrawer } from "@/components/v2/RecentDrawer";
import { TimeUpDrawer } from "@/components/v2/TimeUpDrawer";
import { FindDialog } from "@/components/v2/FindDialog";
import { ExtendPlayModal } from "@/components/v2/ExtendPlayModal";
import { DayMeters } from "@/components/v2/DayMeters";
import { Users, Clock, Utensils, LayoutDashboard, Plus } from "lucide-react";

export default function V2HandheldPos() {
  const staff = useV2Store((s) => s.staff);
  const setStaff = useV2Store((s) => s.setStaff);
  const visits = useV2Store((s) => s.visits);
  const bootstrap = useV2Store((s) => s.bootstrap);
  const initRealtime = useV2Store((s) => s.initRealtime);
  const [sessionIsAdmin, setSessionIsAdmin] = useState(false);
  const isAdmin = sessionIsAdmin;

  const [activeTab, setActiveTab] = useState<"admit" | "radar" | "order" | "admin">("radar");
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [isAuditDrawerOpen, setIsAuditDrawerOpen] = useState(false);
  const [isAdminHubOpen, setIsAdminHubOpen] = useState(false);
  const [isRecentOpen, setIsRecentOpen] = useState(false);
  const [isTimeUpOpen, setIsTimeUpOpen] = useState(false);
  const [isFindOpen, setIsFindOpen] = useState(false);
  const [extendVisit, setExtendVisit] = useState<VisitView | null>(null);

  const [selectedVisitForOrder, setSelectedVisitForOrder] = useState<VisitView | null>(null);
  const [selectedVisitForCheckout, setSelectedVisitForCheckout] = useState<VisitView | null>(null);
  const [showDesktopAdmit, setShowDesktopAdmit] = useState(false);

  useEffect(() => {
    bootstrap();
    const unsub = initRealtime();
    return () => unsub();
  }, [bootstrap, initRealtime]);

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

  useEffect(() => {
    if (!staff && typeof window !== "undefined") {
      const timer = setTimeout(() => setIsStaffModalOpen(true), 600);
      return () => clearTimeout(timer);
    }
  }, [staff]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsFindOpen(true);
        return;
      }
      if (e.key === "Escape") {
        setIsFindOpen(false);
        setIsRecentOpen(false);
        setIsTimeUpOpen(false);
        return;
      }
      if (typing) return;
      if (e.key.toLowerCase() === "r" && !e.ctrlKey && !e.metaKey) setIsRecentOpen(true);
      if (e.key.toLowerCase() === "t" && !e.ctrlKey && !e.metaKey) setIsTimeUpOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const activeVisitsCount = visits.filter((v) => v.status === "open").length;

  const floorHandlers = {
    onSelectForOrder: (v: VisitView) => {
      setSelectedVisitForOrder(v);
      setActiveTab("order");
    },
    onSelectForCheckout: (v: VisitView) => setSelectedVisitForCheckout(v),
    onExtend: (v: VisitView) => setExtendVisit(v),
  };

  return (
    <div className="till-ui h-dvh max-h-dvh md:overflow-hidden overflow-x-hidden bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans select-none antialiased">
      <TopBar
        onOpenStaffModal={() => setIsStaffModalOpen(true)}
        onOpenAudit={() => setIsAuditDrawerOpen(true)}
        onOpenAdmin={() => {
          if (isAdmin) setIsAdminHubOpen(true);
        }}
        onOpenRecent={() => setIsRecentOpen(true)}
        onOpenTimeUp={() => setIsTimeUpOpen(true)}
        onOpenFind={() => setIsFindOpen(true)}
      />

      <CounterPrintBridge />

      {/* DESKTOP — calm two panes; only lists scroll (hidden bars) */}
      <div className="hidden md:grid flex-1 min-h-0 max-w-[1600px] w-full mx-auto p-3 gap-3 grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] overflow-hidden relative">
        <section className="min-h-0 flex flex-col gap-2 overflow-hidden">
          <DayMeters />

          <div className="flex items-center justify-between shrink-0">
            <h2 className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-500" />
              Floor
              <span className="text-[11px] font-medium text-slate-500 tabular-nums">{activeVisitsCount}</span>
            </h2>
            <button
              type="button"
              onClick={() => setShowDesktopAdmit(!showDesktopAdmit)}
              className="py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 active:scale-[0.985] shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              {showDesktopAdmit ? "Close admit" : "Admit"}
            </button>
          </div>

          <div className="min-h-0 flex-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm relative">
            {showDesktopAdmit ? (
              <div className="absolute inset-0 z-20 bg-white dark:bg-slate-900 till-scroll overflow-y-auto">
                <div className="sticky top-0 z-10 flex items-center justify-between px-3 py-2 border-b border-slate-100 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-100">New admission</p>
                  <button
                    type="button"
                    onClick={() => setShowDesktopAdmit(false)}
                    className="text-[11px] font-semibold text-slate-500 hover:text-slate-800"
                  >
                    Back to floor
                  </button>
                </div>
                <AdmissionView onSuccess={() => setShowDesktopAdmit(false)} />
              </div>
            ) : null}
            <div className="till-scroll h-full overflow-y-auto overscroll-contain">
              <FloorRadar {...floorHandlers} />
            </div>
          </div>
        </section>

        <section className="min-h-0 flex flex-col gap-2 overflow-hidden">
          <div className="flex items-center justify-between shrink-0">
            <h2 className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Utensils className="h-4 w-4 text-slate-500" />
              Orders
            </h2>
            <span className="text-[11px] font-medium text-slate-500">
              {selectedVisitForOrder ? selectedVisitForOrder.code : "Walk-in"}
            </span>
          </div>

          <div className="min-h-0 flex-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
            <OrderView
              targetVisit={selectedVisitForOrder}
              onClearTargetVisit={() => setSelectedVisitForOrder(null)}
              onOrderSent={() => setSelectedVisitForOrder(null)}
            />
          </div>
        </section>
      </div>

      {/* MOBILE */}
      <main className="till-scroll md:hidden flex-1 min-h-0 pb-20 flex flex-col overflow-y-auto overscroll-contain">
        {activeTab === "admit" && (
          <AdmissionView
            onSuccess={() => {
              setActiveTab("radar");
            }}
          />
        )}

        {activeTab === "radar" && (
          <>
            <div className="px-4 pt-3">
              <DayMeters />
            </div>
            <FloorRadar {...floorHandlers} />
          </>
        )}

        {activeTab === "order" && (
          <div className="flex-1 min-h-0 h-[calc(100dvh-8.5rem)]">
            <OrderView
              targetVisit={selectedVisitForOrder}
              onClearTargetVisit={() => setSelectedVisitForOrder(null)}
              onOrderSent={() => {
                setSelectedVisitForOrder(null);
                setActiveTab("radar");
              }}
            />
          </div>
        )}

        {activeTab === "admin" && isAdmin && (
          <div className="p-3 sm:p-4">
            <AdminHubModal isOpen={true} onClose={() => setActiveTab("radar")} />
          </div>
        )}
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-2 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] transition-colors">
        <div className={`max-w-lg mx-auto grid gap-1 ${isAdmin ? "grid-cols-4" : "grid-cols-3"}`}>
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

      <StaffDeviceSetupModal isOpen={isStaffModalOpen} onClose={() => setIsStaffModalOpen(false)} />

      <CheckoutModal
        visit={selectedVisitForCheckout}
        onClose={() => setSelectedVisitForCheckout(null)}
        onSettled={() => {
          setSelectedVisitForCheckout(null);
          setActiveTab("radar");
          void bootstrap();
        }}
      />

      <LiveAuditDrawer isOpen={isAuditDrawerOpen} onClose={() => setIsAuditDrawerOpen(false)} />

      <RecentDrawer isOpen={isRecentOpen} onClose={() => setIsRecentOpen(false)} />

      <TimeUpDrawer
        isOpen={isTimeUpOpen}
        onClose={() => setIsTimeUpOpen(false)}
        onSettle={(v) => setSelectedVisitForCheckout(v)}
        onExtend={(v) => setExtendVisit(v)}
      />

      <FindDialog
        isOpen={isFindOpen}
        onClose={() => setIsFindOpen(false)}
        onOpenVisit={(v) => {
          setSelectedVisitForOrder(v);
          setActiveTab("order");
        }}
        onSettle={(v) => setSelectedVisitForCheckout(v)}
      />

      <ExtendPlayModal
        visit={extendVisit}
        onClose={() => setExtendVisit(null)}
        onDone={() => void bootstrap()}
        onSettle={(v) => setSelectedVisitForCheckout(v)}
      />

      {isAdmin ? (
        <AdminHubModal isOpen={isAdminHubOpen} onClose={() => setIsAdminHubOpen(false)} />
      ) : null}
    </div>
  );
}
