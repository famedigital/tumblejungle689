"use client";

import { useEffect, useState } from "react";
import { useV2Store } from "@/lib/v2/store";
import { User, Smartphone, Check, Sparkles } from "lucide-react";

export function StaffDeviceSetupModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const staff = useV2Store((s) => s.staff);
  const setStaff = useV2Store((s) => s.setStaff);
  const staffList = useV2Store((s) => s.staffList);

  const [selectedName, setSelectedName] = useState(() => staff?.staffName || "");
  const [deviceLabel, setDeviceLabel] = useState(() => {
    if (staff?.deviceLabel) return staff.deviceLabel;
    if (typeof window !== "undefined") {
      const ua = navigator.userAgent;
      if (/iPhone/i.test(ua)) return "iPhone Floor";
      if (/iPad/i.test(ua)) return "iPad Counter";
      if (/Android/i.test(ua)) return "Android Handheld";
      if (/Windows/i.test(ua)) return "Windows Counter";
      if (/Mac/i.test(ua)) return "Mac Device";
    }
    return "Staff Handheld";
  });

  useEffect(() => {
    if (!staff) return;
    const t = window.setTimeout(() => {
      setSelectedName(staff.staffName);
      setDeviceLabel(staff.deviceLabel);
    }, 0);
    return () => clearTimeout(t);
  }, [staff]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!selectedName.trim()) return;
    const matched = staffList.find((s) => s.name === selectedName);
    const deviceId =
      staff?.deviceId ||
      "DEV-" + Math.random().toString(36).substring(2, 8).toUpperCase();

    setStaff({
      staffId: matched?.id,
      staffName: selectedName.trim(),
      role: matched?.role || "floor",
      deviceLabel: deviceLabel.trim() || "Staff Handheld",
      deviceId,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-6 text-slate-900 dark:text-slate-100">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 dark:bg-emerald-400/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold text-lg text-slate-900 dark:text-white">
              Staff & Device Setup
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Stamped on all orders & printouts
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5 mb-2">
              <User className="h-3.5 w-3.5" /> Staff Name
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
              {staffList.length > 0 ? (
                staffList.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedName(s.name)}
                    className={`py-2 px-3 rounded-lg text-sm font-medium border text-left transition-all ${
                      selectedName === s.name
                        ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-800 dark:text-emerald-300 shadow-sm"
                        : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                    }`}
                  >
                    {s.name}
                  </button>
                ))
              ) : (
                <input
                  type="text"
                  placeholder="e.g. Dorji"
                  value={selectedName}
                  onChange={(e) => setSelectedName(e.target.value)}
                  className="col-span-2 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              )}
            </div>
            {staffList.length > 0 && (
              <input
                type="text"
                placeholder="Or type custom name..."
                value={selectedName}
                onChange={(e) => setSelectedName(e.target.value)}
                className="mt-2 w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            )}
          </div>

          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5 mb-1.5">
              <Smartphone className="h-3.5 w-3.5" /> Device Label
            </label>
            <input
              type="text"
              placeholder="e.g. Dorji's iPhone / Floor Tab"
              value={deviceLabel}
              onChange={(e) => setDeviceLabel(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Kitchen and counter tickets will show this device name.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={!selectedName.trim()}
            className="w-full mt-2 py-3 px-4 rounded-xl font-medium text-sm flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none"
          >
            <Check className="h-4 w-4" /> Ready to Take Orders
          </button>
        </div>
      </div>
    </div>
  );
}
