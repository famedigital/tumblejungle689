# MASTER DESIGN SYSTEM: TUMBLE JUNGLE (PLAYTAB ENTERPRISE)
### Authoritative Standard: `C:\GitHub\POS\docs\MASTER-DESIGN-SYSTEM.md`
**Design Benchmark:** The Sovereign Glass & 0-Latency Architecture (ECCD & Atheros Benchmark)

---

## 1. Executive Diagnosis: Why the Current System is Slow & Poor

| Performance / UX Defect | Technical Root Cause in Current Code | Master Design System Remedy (0-Latency & Atheros Standard) |
|---|---|---|
| **1. UI Sluggishness & Touch Lag (POS Tills / Tablets)** | 4,150 lines of bloated CSS (`perspective: 860px`, `rotateX(8deg)`, faux-paper curl SVG gradients, multi-layer inset box shadows). The browser recalculates 3D matrices on every state change. | **Zero Skeuomorphic Tilt Law**: Hardware-accelerated flat frosted glass (`backdrop-filter: blur(24px)`) with **1px top specular highlight** (`border-t-white/95 border-b-black/10`). Zero GPU matrix re-layout. |
| **2. Cascading Render Freezes** | 29 React 19 violations (`react-hooks/set-state-in-effect`, `react-hooks/refs` in `hotkeys.ts`, `tender-sheet.tsx`). Synchronous `setState` inside `useEffect` causes 3 to 4 full DOM repaints on a single keystroke. | **The 0-Latency Law (RAM First)**: In-memory CPU RAM state cache with SWR (Stale-While-Revalidate). Synchronous keystroke handling in **0–2 ms**; network sync is deferred to background worker tasks. |
| **3. Poor Visual Hierarchy & Inconsistent Theme** | Dark mode has muddy contrast; light mode has washed-out text (`text-white` on pale gray); "candy" mode is fragmented and unpolished. | **Dual-Theme Sovereign Glassmorphism**: **Frosted Ceramic** (Light `#f8fafc` + Royal Pine `#1a4332`) & **Smoked Obsidian** (Dark `#09090b` + Saffron Gold `#d97706`). Strict contrast typography. |
| **4. Fragmented Navigation & Clunky Flow** | Staff manually jump between `/desk`, `/counter/cafe`, `/cashier`, `/display`, and `/admin`. No global command palette; no single-key shortcuts. | **The Linear × Stripe 3-Zone Workspace**: Floating specular topbar with `Ctrl+K` Command Palette, Atheros Bento Horizon Deck, and 1-tap `PersonaSwitcher`. |
| **5. Clunky Mobile / Tablet Usability** | Desktop-biased forms without thumb-zone ergonomics. Hard to reach buttons at top of screen on handheld devices. | **Atheros Mobile Thumb Cockpit**: Top 40% glanceable telemetry; Bottom 60% thumb-reach action sheet with quick-tap chips and drag handles. |
| **6. Insecurity & Manual Login Delays** | Staff share sessions or type passwords. No quick handoff between shifts. | **4-Digit Role PIN Standard (0.5s Handshake)**: Instant numeric unlock with 15-minute idle lock and server-side wholesale cost redaction. |

---

## 2. Visual Architecture & Design Tokens

### 2.1 Dual-Theme Glassmorphism
All screens support instantaneous theme switching via `html.dark` or `html.light`:

```css
/* Light Mode ("Frosted Ceramic") */
.glass-panel-light, .glass-panel {
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border-top: 1px solid rgba(255, 255, 255, 0.95);
  border-left: 1px solid rgba(255, 255, 255, 0.60);
  border-right: 1px solid rgba(226, 232, 240, 0.80);
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.05), inset 0 1px 1px #fff;
}

/* Dark Mode ("Smoked Obsidian") */
.dark .glass-panel-dark, .dark .glass-panel {
  background: rgba(9, 9, 11, 0.78);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border-top: 1px solid rgba(255, 255, 255, 0.22);
  border-left: 1px solid rgba(255, 255, 255, 0.12);
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  border-bottom: 1px solid rgba(0, 0, 0, 0.45);
  box-shadow: 0 16px 50px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.15);
}
```

### 2.2 Bhutan Sovereign Palette (Royal Pine & Saffron)
- **Primary Ambient Jewel:** Royal Bhutan Pine Green (`#1a4332`, dark `#2d6a4f`) — confidence, stability, and trust.
- **Secondary Accent Jewel:** Saffron Gold (`#d97706`, dark `#f59e0b`) — energy, royal commerce, playfulness.
- **Status Tints:**
  * Emerald `#10b981`: Active jumper (> 15m left) / Paid KOT.
  * Amber `#f59e0b`: Time warning (< 15m left) / Fired KOT in preparation.
  * Crimson `#ef4444`: Overtime active / Unpaid balance alert.
  * Violet `#8b5cf6`: Kitchen order ticket dispatched.

---

## 3. Desktop UX Standards (Linear × Stripe Benchmarks)

### 3.1 The 3-Zone Workspace

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ 1. FLOATING SPECULAR TOPBAR                                                            │
│ [ 🦁 Tumble Jungle ]  [ 🔍 Ctrl+K Quick Find... ]  [ ⏱️ 15:42 ] [ 🟢 28/40 ] [ 👑 Owner ]│
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 2. ATHEROS BENTO HORIZON DECK                                                          │
│ ┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐ ┌──────────────────┐ │
│ │ 💰 Takings Ring   │ │ ⏱️ Active Jumpers │ │ ⚠️ Overtime Radar │ │ 🍽️ KOT Active    │ │
│ │ Nu. 42,500        │ │ 28 Children       │ │ 3 Overdue         │ │ 4 Orders         │ │
│ └───────────────────┘ └───────────────────┘ └───────────────────┘ └──────────────────┘ │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 3. DENSE PINE SPREADSHEETS (DATA TABLES & TOUCH TILL)                                  │
│ [ Code ]  [ Phone ]       [ Guardian ]    [ Plan ]     [ Paid Until ]  [ Due ] [ Action]│
│ TJ-841    17123456        Sonam Dorji     60m + 2Socks 16:30 (18m left) Nu. 0  [ Settle]│
│ TJ-842    77890123        Dechen Wangmo   30m Jump     15:40 (+2m Over) Nu. 10 [ Extend]│
└────────────────────────────────────────────────────────────────────────────────────────┘
```

1. **Floating Specular Topbar**:
   - Houses the `Ctrl+K` Command Palette: instant lookup for phone, ticket code, child name, or product item.
   - Live occupancy pill (`28/40 Capacity`) with radial health glow.
   - Dual-theme toggle (Sun/Moon), Audio Soundscape toggle (Chimes on/off), and Quick PIN Lock.
2. **The Atheros Bento Horizon Deck**:
   - 4 modular bento cards displaying live SVG progress rings (Revenue target, capacity percentage, overtime queue, kitchen queue).
3. **Dense Pine Spreadsheets & Touch Till**:
   - **Tabular Figures**: Every amount, phone number, and countdown uses `font-mono tabular-nums`.
   - **Dual Action Header**: Every table includes `[ 📥 Export Excel (.xlsx) ]` and `[ 🖨️ Clean Print / Thermal Receipt ]`.

---

## 4. Mobile UX Standards (Atheros Mobile Cockpit)

### 4.1 Thumb-Zone Ergonomics (Bottom 60% Action Zone)
- Top 40% of the screen is glanceable executive telemetry (Active jumpers, revenue total, capacity ring).
- Bottom 60% is thumb-reachable:
  * Swipeable bottom sheets with drag-handle physics for child check-in and quick extension.
  * Floating Action Bar with quick-tap chips (`30m`, `60m`, `90m`, `+1 Pair Socks`, `+2 Pairs Socks`).
  * 1-tap WhatsApp alert generator: *"Hi [Guardian], [Child]'s play session at Tumble Jungle ends in 5 minutes!"*

---

## 5. Security & Authentication Architecture

### 5.1 4-Digit Role PIN Standard (0.5-Second Switch)
- Terminal stays logged in to shop account.
- Staff switch roles instantly using 4-digit PIN:
  * **Owner PIN (`1234`)**: Full access (takings, P&L, catalog pricing, voids, staff audit).
  * **Frontdesk PIN (`5678`)**: Fast admission, sticker wristband printing, waiver toggle.
  * **Floor PIN (`2468`)**: Live floor radar, overtime waiver, WhatsApp notifications.
  * **Cashier PIN (`9012`)**: Locked strictly to POS till tender and Bhutan RMA EMV QR payments.
- **Server-Side Redaction**: Sensitive wholesale cost figures are redacted from API payloads for non-owner sessions.

---

## 6. Implementation Checklist for Cursor

- [x] Master Design System CSS tokens added to `app/globals.css` (`glass-ambient-canvas`, `glass-panel-light`, `glass-panel-dark`, `glass-interactive`, `tabular-nums-dense`, `mobile-thumb-cockpit`).
- [ ] Connect `HeaderTopBar` with `Ctrl+K` command palette across all routes.
- [ ] Wire in-memory client RAM cache with SWR in `useTillBook.ts` to ensure 0–2ms keystroke latency.
- [ ] Refactor `hotkeys.ts` and `tender-sheet.tsx` to eliminate React 19 `setState` inside `useEffect` errors.
- [ ] Implement `AtherosBentoDeck` with SVG progress rings on the dashboard.
- [ ] Build `MobileThumbCockpit` for mobile and 10.1" tablet viewports.
- [ ] Add 4-Digit Role PIN lock screen with 15-minute idle timeout.
