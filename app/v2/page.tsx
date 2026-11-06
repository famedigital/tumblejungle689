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
import { CounterPrintBridge } from "@/components/v2/CounterPrintBridge";
import { Users, Clock, Utensils, Activity } from "lucide-react";

export default function V2HandheldPos() {
  const staff = useV2Store((s) => s.staff);
  const visits = useV2Store((s) => s.visits);
  const bootstrap = useV2Store((s) => s.bootstrap);
  const initRealtime = useV2Store((s) => s.initRealtime);

  const [activeTab, setActiveTab] = useState<"admit" | "radar" | "order" | "audit">("radar");
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [isAuditDrawerOpen, setIsAuditDrawerOpen] = useState(false);

  const [selectedVisitForOrder, setSelectedVisitForOrder] = useState<VisitView | null>(null);
  const [selectedVisitForCheckout, setSelectedVisitForCheckout] = useState<VisitView | null>(null);

  useEffect(() => {
    bootstrap();
    const unsub = initRealtime();
    return () => unsub();
  }, [bootstrap, initRealtime]);

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
      />

      {/* Embedded Counter Print & Audio Bridge */}
      <CounterPrintBridge />

      {/* Main Content Area */}
      <main className="flex-1 pb-20">
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

        {activeTab === "audit" && (
          <div className="p-4">
            <LiveAuditDrawer
              isOpen={true}
              onClose={() => setActiveTab("radar")}
            />
          </div>
        )}
      </main>

      {/* Bottom Thumb Cockpit Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-2 py-1.5 transition-colors">
        <div className="max-w-lg mx-auto grid grid-cols-4 gap-1">
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

          {/* Live Audit Stream */}
          <button
            type="button"
            onClick={() => setIsAuditDrawerOpen(true)}
            className="flex flex-col items-center justify-center py-1.5 px-1 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-700 font-medium transition-all"
          >
            <Activity className="h-5 w-5" />
            <span className="text-[10px] mt-1">Audit</span>
          </button>
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
    </div>
  );
}
