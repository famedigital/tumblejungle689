"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ShieldCheck,
  Delete,
  User,
  KeyRound,
  ArrowRight,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { useV2Store } from "@/lib/v2/store";

interface StaffOption {
  id: number;
  name: string;
  role: string;
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next") || "/v2";
  const urlError = searchParams.get("error");

  const setStoreStaff = useV2Store((s) => s.setStaff);

  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<StaffOption | null>(null);
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(urlError || null);
  const [shake, setShake] = useState(false);
  const [usePasswordMode, setUsePasswordMode] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");

  // Fetch available staff members
  useEffect(() => {
    fetch("/api/auth/staff-list")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && Array.isArray(data.staff) && data.staff.length > 0) {
          setStaffList(data.staff);
          setSelectedStaff(data.staff[0]);
        }
      })
      .catch((err) => console.error("Staff list fetch error:", err));
  }, []);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleLoginSubmit = useCallback(
    async (secretToVerify: string) => {
      if (!secretToVerify.trim() || loading) return;
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            secret: secretToVerify.trim(),
            staffId: selectedStaff?.id,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.ok) {
          setError(data.error || "Incorrect PIN or password.");
          triggerShake();
          setPin("");
          setPasswordInput("");
          return;
        }

        // Successfully authenticated!
        // Sync v2 client store
        if (data.staff) {
          setStoreStaff({
            staffId: data.staff.id,
            staffName: data.staff.name,
            role: data.staff.role,
            deviceLabel: "Active Station",
            deviceId: "STATION-" + Math.random().toString(36).substring(2, 6).toUpperCase(),
          });
        }

        // Redirect to intended target
        const destination =
          data.staff.role === "admin" && (nextUrl === "/v2" || nextUrl === "/")
            ? "/v2/admin"
            : nextUrl;

        router.push(destination);
        router.refresh();
      } catch (err) {
        console.error("Login error:", err);
        setError("Network error. Please try again.");
        triggerShake();
        setPin("");
      } finally {
        setLoading(false);
      }
    },
    [loading, selectedStaff, nextUrl, router, setStoreStaff]
  );

  // Auto-submit when 4 digits are entered
  const handleDigitPress = (digit: string) => {
    if (loading || pin.length >= 6) return;
    const nextPin = pin + digit;
    setPin(nextPin);
    setError(null);

    if (nextPin.length === 4) {
      void handleLoginSubmit(nextPin);
    }
  };

  const handleBackspace = () => {
    if (loading) return;
    setPin((prev) => prev.slice(0, -1));
    setError(null);
  };

  const handleClear = () => {
    if (loading) return;
    setPin("");
    setError(null);
  };

  // Keyboard support for typing PIN
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (usePasswordMode) return;
      if (e.key >= "0" && e.key <= "9") {
        handleDigitPress(e.key);
      } else if (e.key === "Backspace") {
        handleBackspace();
      } else if (e.key === "Escape") {
        handleClear();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [usePasswordMode, pin, loading]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 flex flex-col justify-between p-4 sm:p-6 font-sans antialiased selection:bg-emerald-500 selection:text-white">
      {/* Top Bar with Venue Info & Back Link */}
      <header className="max-w-md w-full mx-auto flex items-center justify-between py-2">
        <Link
          href="/"
          className="text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors flex items-center gap-1.5"
        >
          <span>← Back to Public Website</span>
        </Link>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          STAFF ACCESS
        </span>
      </header>

      {/* Main Authentication Card */}
      <main className="max-w-md w-full mx-auto my-auto py-4">
        <div className="rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white/90 dark:bg-slate-900/80 backdrop-blur-xl shadow-2xl p-6 sm:p-8 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center shadow-inner">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-extrabold text-2xl tracking-tight text-slate-900 dark:text-white">
                Tumble Jungle
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Enterprise Station Sign-In • Staff PIN Pad
              </p>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Admin + Staff quick select */}
          {staffList.length > 0 && (
            <div className="space-y-3">
              {(() => {
                const admins = staffList.filter((s) => s.role === "admin");
                const staff = staffList.filter((s) => s.role !== "admin");
                const chip = (st: StaffOption) => {
                  const isSelected = selectedStaff?.id === st.id;
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => {
                        setSelectedStaff(st);
                        setError(null);
                        setPin("");
                      }}
                      className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                        isSelected
                          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm ring-2 ring-emerald-500/50"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                      }`}
                    >
                      <User className="h-3.5 w-3.5" />
                      <span>{st.name}</span>
                    </button>
                  );
                };
                return (
                  <>
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block text-center">
                        Admin
                      </span>
                      <div className="flex items-center justify-center gap-2 flex-wrap">
                        {admins.length > 0 ? admins.map(chip) : (
                          <span className="text-[11px] text-slate-400">No admin configured</span>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block text-center">
                        Staff
                      </span>
                      <div className="flex items-center justify-center gap-2 flex-wrap">
                        {staff.length > 0 ? staff.map(chip) : (
                          <span className="text-[11px] text-slate-400">No staff configured</span>
                        )}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* PIN Pad View vs Password View */}
          {!usePasswordMode ? (
            <div className="space-y-5">
              {/* Masked PIN Indicator Dots */}
              <div
                className={`flex items-center justify-center gap-3.5 py-2 ${
                  shake ? "animate-bounce" : ""
                }`}
              >
                {[0, 1, 2, 3].map((idx) => {
                  const isFilled = pin.length > idx;
                  return (
                    <div
                      key={idx}
                      className={`h-4 w-4 rounded-full border-2 transition-all ${
                        isFilled
                          ? "bg-emerald-500 border-emerald-500 scale-110 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                          : "border-slate-300 dark:border-slate-700 bg-transparent"
                      }`}
                    />
                  );
                })}
              </div>

              {/* Number Numpad Grid */}
              <div className="grid grid-cols-3 gap-2.5 max-w-[260px] mx-auto">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"].map(
                  (key) => {
                    if (key === "clear") {
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={handleClear}
                          disabled={loading || pin.length === 0}
                          className="h-14 rounded-2xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-slate-800/80 text-xs font-bold text-slate-500 dark:text-slate-400 transition-all active:scale-95 disabled:opacity-30 flex items-center justify-center"
                        >
                          Clear
                        </button>
                      );
                    }
                    if (key === "back") {
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={handleBackspace}
                          disabled={loading || pin.length === 0}
                          className="h-14 rounded-2xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-600 dark:text-slate-300 transition-all active:scale-95 disabled:opacity-30 flex items-center justify-center"
                        >
                          <Delete className="h-5 w-5" />
                        </button>
                      );
                    }
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleDigitPress(key)}
                        disabled={loading}
                        className="h-14 rounded-2xl border border-slate-200/90 dark:border-white/10 bg-white dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 font-mono text-xl font-black text-slate-900 dark:text-white transition-all active:scale-95 shadow-sm flex items-center justify-center"
                      >
                        {key}
                      </button>
                    );
                  }
                )}
              </div>
            </div>
          ) : (
            /* Alphanumeric Password Fallback Form */
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleLoginSubmit(passwordInput);
              }}
              className="space-y-4"
            >
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase block mb-1">
                  Master Password or PIN
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    autoFocus
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Enter password..."
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !passwordInput.trim()}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
              >
                {loading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Mode Switcher Toggle */}
          <div className="pt-2 border-t border-slate-200/80 dark:border-white/10 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => {
                setUsePasswordMode(!usePasswordMode);
                setError(null);
                setPin("");
                setPasswordInput("");
              }}
              className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
            >
              <KeyRound className="h-3.5 w-3.5" />
              <span>
                {usePasswordMode ? "Use Quick PIN Pad" : "Use Password instead"}
              </span>
            </button>

            <span className="text-[10px] text-slate-400 text-right leading-relaxed">
              Admin <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono font-bold text-slate-700 dark:text-slate-300">9999</code>
              <br />
              Staff <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono font-bold text-slate-700 dark:text-slate-300">1111</code>
              {" · "}
              <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono font-bold text-slate-700 dark:text-slate-300">2222</code>
              {" · "}
              <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono font-bold text-slate-700 dark:text-slate-300">3333</code>
            </span>
          </div>
        </div>
      </main>

      {/* Bottom Footer */}
      <footer className="max-w-md w-full mx-auto text-center py-2 space-y-1">
        <p className="text-[11px] text-slate-500 dark:text-slate-500">
          Tumble Jungle • Secure Session Authentication (HTTP-Only Signed)
        </p>
      </footer>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 dark:bg-[#090d16] flex items-center justify-center">
          <RefreshCw className="h-6 w-6 animate-spin text-emerald-500" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
