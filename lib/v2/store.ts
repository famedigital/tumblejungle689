import { create } from "zustand";
import { supabase, REALTIME_CHANNEL } from "./supabase";
import type { AuditEvent, StaffIdentity, V2BootstrapData, V2PrintJob } from "./types";
import type { MenuItem, PayMethod, Rate, VisitView } from "@/lib/types";

type CartItem = {
  item: MenuItem;
  qty: number;
};

interface V2State {
  // Identity
  staff: StaffIdentity | null;
  setStaff: (identity: StaffIdentity) => void;

  // Connection
  isConnected: boolean;
  setConnected: (status: boolean) => void;
  lastPingMs: number;

  // Venue Data
  venueName: string;
  rates: Rate[];
  extraPerMinNu: number;
  bankPayload: string;
  bankAccount: string;
  payee: string;
  city: string;
  address: string;
  menu: MenuItem[];
  staffList: { id: number; name: string; role: string }[];
  todayNu: number;
  playNu: number;
  foodNu: number;

  // Visits
  visits: VisitView[];
  selectedVisitId: number | null;
  setSelectedVisitId: (id: number | null) => void;

  // Cart for Food / KOT
  cart: CartItem[];
  addToCart: (item: MenuItem, qty?: number) => void;
  removeFromCart: (itemId: number) => void;
  updateCartQty: (itemId: number, delta: number) => void;
  clearCart: () => void;

  // Audit
  auditEvents: AuditEvent[];
  addAuditEvent: (event: Omit<AuditEvent, "id" | "timestamp">) => void;

  // Actions
  bootstrap: () => Promise<void>;
  initRealtime: () => () => void;

  // Optimistic Operations
  admitChild: (payload: {
    phone: string;
    guardianName: string;
    childCount: number;
    minutes: number;
    socksCount: number;
    socksNu: number;
    method: PayMethod;
    journal?: string;
    payBank?: string;
    printWristband: boolean;
  }) => Promise<{ ok: boolean; visit?: VisitView; error?: string }>;

  sendKot: (payload: {
    visitId?: number;
    tableNo?: string;
    notes?: string;
  }) => Promise<{ ok: boolean; error?: string }>;

  settleVisit: (payload: {
    visitId: number;
    method: PayMethod;
    amountNu: number;
    journal?: string;
    payBank?: string;
    printReceipt: boolean;
  }) => Promise<{ ok: boolean; receiptNo?: number; error?: string }>;

  dispatchRemotePrint: (job: Omit<V2PrintJob, "id" | "timestamp" | "staffName" | "deviceLabel">) => Promise<void>;
}

export const useV2Store = create<V2State>((set, get) => ({
  staff: null,
  setStaff: (identity) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("tj_v2_staff", JSON.stringify(identity));
    }
    set({ staff: identity });
  },

  isConnected: false,
  setConnected: (status) => set({ isConnected: status }),
  lastPingMs: 0,

  venueName: "Tumble Jungle",
  rates: [
    { minutes: 30, amountNu: 200 },
    { minutes: 60, amountNu: 350 },
    { minutes: 90, amountNu: 480 },
    { minutes: 120, amountNu: 600 },
  ],
  extraPerMinNu: 10,
  bankPayload: "",
  bankAccount: "",
  payee: "Tumble Jungle",
  city: "Thimphu",
  address: "",
  menu: [],
  staffList: [],
  todayNu: 0,
  playNu: 0,
  foodNu: 0,

  visits: [],
  selectedVisitId: null,
  setSelectedVisitId: (id) => set({ selectedVisitId: id }),

  cart: [],
  addToCart: (item, qty = 1) => {
    set((state) => {
      const idx = state.cart.findIndex((c) => c.item.id === item.id);
      if (idx >= 0) {
        const next = [...state.cart];
        next[idx] = { ...next[idx], qty: next[idx].qty + qty };
        return { cart: next.filter((c) => c.qty > 0) };
      }
      return { cart: [...state.cart, { item, qty }] };
    });
  },
  removeFromCart: (itemId) => {
    set((state) => ({ cart: state.cart.filter((c) => c.item.id !== itemId) }));
  },
  updateCartQty: (itemId, delta) => {
    set((state) => {
      const next = state.cart
        .map((c) => (c.item.id === itemId ? { ...c, qty: c.qty + delta } : c))
        .filter((c) => c.qty > 0);
      return { cart: next };
    });
  },
  clearCart: () => set({ cart: [] }),

  auditEvents: [],
  addAuditEvent: (evt) => {
    const full: AuditEvent = {
      id: Math.random().toString(36).substring(2, 9),
      ...evt,
      timestamp: new Date().toISOString(),
    };
    set((state) => ({ auditEvents: [full, ...state.auditEvents.slice(0, 99)] }));
  },

  bootstrap: async () => {
    try {
      // Load saved staff identity if present
      if (typeof window !== "undefined") {
        const raw = localStorage.getItem("tj_v2_staff");
        if (raw) {
          try {
            set({ staff: JSON.parse(raw) });
          } catch {}
        }
      }

      const res = await fetch("/api/v2/bootstrap");
      if (!res.ok) throw new Error("Failed to load bootstrap data");
      const data: V2BootstrapData = await res.json();
      set({
        venueName: data.venueName,
        rates: data.rates,
        extraPerMinNu: data.extraPerMinNu,
        bankPayload: data.bankPayload,
        bankAccount: data.bankAccount || "",
        payee: data.payee,
        city: (data as V2BootstrapData & { city?: string }).city || "Thimphu",
        address: data.address || "",
        menu: data.menu,
        visits: data.visits,
        staffList: data.staff,
        todayNu: data.todayNu,
        playNu: data.playNu,
        foodNu: data.foodNu,
      });
    } catch (err) {
      console.error("Bootstrap error:", err);
    }
  },

  initRealtime: () => {
    const channel = supabase.channel(REALTIME_CHANNEL, {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "visit_created" }, ({ payload }) => {
        const { visit, staffName, deviceLabel } = payload;
        set((state) => {
          const exists = state.visits.some((v) => v.id === visit.id);
          const next = exists ? state.visits.map((v) => (v.id === visit.id ? visit : v)) : [visit, ...state.visits];
          return { visits: next };
        });
        get().addAuditEvent({
          type: "admission",
          title: `Admission: ${visit.guardianName || "Child"} (${visit.code})`,
          details: `${visit.childCount} child(ren) - Nu. ${visit.dueNu || 0}`,
          staffName: staffName || "Remote Staff",
          deviceLabel: deviceLabel || "Mobile",
        });
      })
      .on("broadcast", { event: "order_placed" }, ({ payload }) => {
        const { visitId, lines, staffName, deviceLabel, code } = payload;
        set((state) => {
          const next = state.visits.map((v) => {
            if (v.id === visitId) {
              return { ...v, lines: [...v.lines, ...lines] };
            }
            return v;
          });
          return { visits: next };
        });
        get().addAuditEvent({
          type: "order",
          title: `KOT Order: ${code || `Visit #${visitId}`}`,
          details: lines.map((l: { name: string; qty: number }) => `${l.qty}x ${l.name}`).join(", "),
          staffName: staffName || "Remote Staff",
          deviceLabel: deviceLabel || "Mobile",
        });
      })
      .on("broadcast", { event: "visit_settled" }, ({ payload }) => {
        const { visitId, code, amountNu, method, staffName, deviceLabel } = payload;
        set((state) => ({
          visits: state.visits.filter((v) => v.id !== visitId),
          todayNu: state.todayNu + (amountNu || 0),
        }));
        get().addAuditEvent({
          type: "settle",
          title: `Settled: ${code} (Nu. ${amountNu})`,
          details: `Paid via ${method.toUpperCase()}`,
          staffName: staffName || "Remote Staff",
          deviceLabel: deviceLabel || "Mobile",
          amountNu,
        });
      })
      .on("broadcast", { event: "print_job" }, ({ payload }) => {
        const { kind, title, staffName, deviceLabel } = payload;
        get().addAuditEvent({
          type: "print",
          title: `Counter Print: ${title}`,
          details: `Type: ${kind}`,
          staffName: staffName || "Remote Staff",
          deviceLabel: deviceLabel || "Mobile",
        });
      })
      .subscribe((status) => {
        set({ isConnected: status === "SUBSCRIBED" });
      });

    return () => {
      supabase.removeChannel(channel);
    };
  },

  admitChild: async (payload) => {
    const staff = get().staff;
    const staffName = staff?.staffName || "Staff Handheld";
    const deviceLabel = staff?.deviceLabel || "Mobile PWA";

    // Optimistic placeholder
    const tempId = -Math.floor(Math.random() * 100000);
    const tempVisit: VisitView = {
      id: tempId,
      code: "TJ-" + Math.floor(1000 + Math.random() * 9000),
      phone: payload.phone,
      guardianName: payload.guardianName,
      childCount: payload.childCount,
      status: "open",
      createdAt: new Date().toISOString(),
      paidUntil: new Date(Date.now() + payload.minutes * 60000).toISOString(),
      leftAt: null,
      closedAt: null,
      tableNo: "",
      receiptNo: null,
      blocks: [
        {
          id: tempId,
          minutes: payload.minutes,
          amountNu: 0,
          paid: true,
          priorUntil: "",
          extendsTo: "",
          createdAt: new Date().toISOString(),
        },
      ],
      lines: payload.socksCount > 0 ? [
        {
          id: tempId,
          name: "Grip Socks",
          qty: payload.socksCount,
          unitNu: payload.socksNu,
          amountNu: payload.socksCount * payload.socksNu,
          outlet: "cafe",
          paid: false,
          firedQty: 0,
          deliveredQty: 0,
        }
      ] : [],
      payments: [],
      dueNu: payload.socksCount * payload.socksNu,
      overtime: null,
    };

    // 0ms Optimistic UI update
    set((state) => ({ visits: [tempVisit, ...state.visits] }));

    try {
      const res = await fetch("/api/v2/admit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          staffName,
          deviceLabel,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Admission failed");
      }

      const { visit, printJob } = await res.json();

      // Replace optimistic placeholder with real visit
      set((state) => ({
        visits: state.visits.map((v) => (v.id === tempId ? visit : v)),
      }));

      // Broadcast to other phones & counter via Supabase WebSocket
      await supabase.channel(REALTIME_CHANNEL).send({
        type: "broadcast",
        event: "visit_created",
        payload: { visit, staffName, deviceLabel },
      });

      if (printJob) {
        await supabase.channel(REALTIME_CHANNEL).send({
          type: "broadcast",
          event: "print_job",
          payload: printJob,
        });
      }

      get().addAuditEvent({
        type: "admission",
        title: `Admission: ${visit.guardianName || "Child"} (${visit.code})`,
        details: `${visit.childCount} child(ren), ${payload.minutes}m`,
        staffName,
        deviceLabel,
      });

      return { ok: true, visit };
    } catch (err) {
      // Revert optimistic
      set((state) => ({ visits: state.visits.filter((v) => v.id !== tempId) }));
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  sendKot: async (payload) => {
    const staff = get().staff;
    const staffName = staff?.staffName || "Staff Handheld";
    const deviceLabel = staff?.deviceLabel || "Mobile PWA";
    const cart = get().cart;

    if (cart.length === 0) return { ok: false, error: "Cart is empty" };

    const items = cart.map((c) => ({
      itemId: c.item.id,
      name: c.item.name,
      qty: c.qty,
      unitNu: c.item.priceNu,
      amountNu: c.qty * c.item.priceNu,
      outlet: c.item.outlet,
    }));

    // Optimistic local clear
    get().clearCart();

    try {
      const res = await fetch("/api/v2/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitId: payload.visitId,
          tableNo: payload.tableNo,
          notes: payload.notes,
          items,
          staffName,
          deviceLabel,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Order dispatch failed");
      }

      const { visit, printJob } = await res.json();

      if (visit) {
        set((state) => ({
          visits: state.visits.map((v) => (v.id === visit.id ? visit : v)),
        }));
      }

      // Broadcast to all phones and counter
      await supabase.channel(REALTIME_CHANNEL).send({
        type: "broadcast",
        event: "order_placed",
        payload: {
          visitId: payload.visitId,
          code: visit?.code || payload.tableNo || "Table Order",
          lines: items,
          staffName,
          deviceLabel,
        },
      });

      if (printJob) {
        await supabase.channel(REALTIME_CHANNEL).send({
          type: "broadcast",
          event: "print_job",
          payload: printJob,
        });
      }

      get().addAuditEvent({
        type: "order",
        title: `KOT Order: ${visit?.code || payload.tableNo || "Floor"}`,
        details: items.map((i) => `${i.qty}x ${i.name}`).join(", "),
        staffName,
        deviceLabel,
      });

      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  settleVisit: async (payload) => {
    const staff = get().staff;
    const staffName = staff?.staffName || "Staff Handheld";
    const deviceLabel = staff?.deviceLabel || "Mobile PWA";

    // Optimistic remove from open visits list
    const visitToSettle = get().visits.find((v) => v.id === payload.visitId);
    set((state) => ({
      visits: state.visits.filter((v) => v.id !== payload.visitId),
      todayNu: state.todayNu + payload.amountNu,
    }));

    try {
      const res = await fetch("/api/v2/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          staffName,
          deviceLabel,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Settlement failed");
      }

      const { printJob, receiptNo } = await res.json();

      await supabase.channel(REALTIME_CHANNEL).send({
        type: "broadcast",
        event: "visit_settled",
        payload: {
          visitId: payload.visitId,
          code: visitToSettle?.code || `Visit #${payload.visitId}`,
          amountNu: payload.amountNu,
          method: payload.method,
          receiptNo,
          staffName,
          deviceLabel,
        },
      });

      if (printJob) {
        await supabase.channel(REALTIME_CHANNEL).send({
          type: "broadcast",
          event: "print_job",
          payload: printJob,
        });
      }

      get().addAuditEvent({
        type: "settle",
        title: `Settled ${visitToSettle?.code || `Visit #${payload.visitId}`}`,
        details: `Nu. ${payload.amountNu} (${payload.method.toUpperCase()}) - Receipt #${receiptNo}`,
        staffName,
        deviceLabel,
        amountNu: payload.amountNu,
      });

      return { ok: true, receiptNo };
    } catch (err) {
      // Revert if failed
      if (visitToSettle) {
        set((state) => ({
          visits: [visitToSettle, ...state.visits],
          todayNu: state.todayNu - payload.amountNu,
        }));
      }
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  dispatchRemotePrint: async (job) => {
    const staff = get().staff;
    const staffName = staff?.staffName || "Staff Handheld";
    const deviceLabel = staff?.deviceLabel || "Mobile PWA";

    const printJob: V2PrintJob = {
      id: "PJ-" + Math.floor(100000 + Math.random() * 900000),
      ...job,
      staffName,
      deviceLabel,
      timestamp: new Date().toISOString(),
    };

    // Broadcast print command to counter listener & print daemon
    await supabase.channel(REALTIME_CHANNEL).send({
      type: "broadcast",
      event: "print_job",
      payload: printJob,
    });

    // Also persist in print_jobs queue in DB
    fetch("/api/v2/print", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(printJob),
    }).catch(console.error);

    get().addAuditEvent({
      type: "print",
      title: `Printed: ${job.title}`,
      details: `Kind: ${job.kind}`,
      staffName,
      deviceLabel,
    });
  },
}));
