# TUMBLE JUNGLE (PLAYTAB ENTERPRISE) SPECIFICATION
### Technical Architecture, Data Contracts & Domain Operations

---

## 1. Domain Entities & Type Definitions

```typescript
// Core Roles & Outlets
export type Role = "admin" | "frontdesk" | "floor" | "cafe" | "restaurant" | "cashier";
export type Outlet = "desk" | "cafe" | "restaurant";
export type PayMethod = "cash" | "bank_qr";

// Visit Status & Jumper Lifecycle
export type VisitStatus = "open" | "hold" | "settled" | "void";

export interface RatePlan {
  id: string;
  minutes: number;
  amountNu: number;
  label: string; // e.g. "1 Hour Jump"
  badgeColor?: string;
}

export interface PlayBlock {
  id: number;
  visitId: number;
  minutes: number;
  amountNu: number;
  paid: boolean;
  priorUntil: string;
  extendsTo: string;
  createdAt: string;
}

export interface TabItemLine {
  id: number;
  lineKey?: string;
  name: string;
  qty: number;
  unitNu: number;
  amountNu: number;
  outlet: Outlet;
  paid: boolean;
  firedQty: number;
  deliveredQty: number;
  notes?: string;
}

export interface VisitProfile {
  id: number;
  code: string; // e.g. "TJ-391"
  phone: string;
  guardianName: string;
  childNames: string[];
  childCount: number;
  socksCount: number;
  status: VisitStatus;
  checkInAt: string;
  paidUntil: string;
  closedAt?: string;
  blocks: PlayBlock[];
  lines: TabItemLine[];
  totalDueNu: number;
  playDueNu: number;
  foodDueNu: number;
  paidNu: number;
}
```

---

## 2. Jumble Pulse AI Contracts

### A. Voice Till Intent Schema (`lib/pulse/voiceIntentSchema.ts`)
```typescript
import { z } from "zod";

export const VoiceTillCommandSchema = z.object({
  action: z.enum(["admission", "add_item", "extend_play", "lookup", "settle"]),
  targetTicketOrPhone: z.string().optional(),
  guardianName: z.string().optional(),
  children: z.number().int().min(1).optional(),
  playMinutes: z.number().int().optional(),
  socks: z.number().int().min(0).optional(),
  items: z.array(z.object({
    name: z.string(),
    qty: z.number().int().min(1),
    outlet: z.enum(["cafe", "restaurant"]).optional(),
    notes: z.string().optional(),
  })).optional(),
  rawTranscript: z.string(),
  confidence: z.number().min(0).max(1),
});

export type VoiceTillCommand = z.infer<typeof VoiceTillCommandSchema>;
```

### B. Bhutan Bank OCR Result Schema (`lib/pulse/bankOcrSchema.ts`)
```typescript
import { z } from "zod";

export const BankOcrResultSchema = z.object({
  detectedBank: z.enum(["mBoB", "BNB", "BDBL", "Druk PNB", "T-Bank", "Other"]),
  journalRef: z.string().min(4),
  amountNu: z.number().positive(),
  timestamp: z.string().optional(),
  confidence: z.number().min(0).max(1),
  rawExtractedText: z.string(),
});

export type BankOcrResult = z.infer<typeof BankOcrResultSchema>;
```

---

## 3. UI Primitives Specification (`components/ui/glass/*`)

| Primitive Component | Props & Variants | Behavior & Theme Tokens |
|---|---|---|
| `GlassCard` | `variant: 'default' \| 'elevated' \| 'active' \| 'glow'`<br/>`padding: 'none' \| 'sm' \| 'md' \| 'lg'` | Frosted glass with `backdrop-blur-xl`. Light: `bg-white/80 border-slate-200/80`. Dark: `bg-slate-900/60 border-white/10`. Zero tilt. |
| `GlassButton` | `tone: 'emerald' \| 'amber' \| 'teal' \| 'rose' \| 'slate' \| 'ghost'`<br/>`size: 'sm' \| 'md' \| 'lg'`<br/>`loading?: boolean` | Physical press interaction: `hover:-translate-y-0.5 active:scale-[0.985]`. Non-blocking audio feedback on click. |
| `GlassBadge` | `tone: 'active' \| 'warning' \| 'overtime' \| 'settled' \| 'kot'`<br/>`size: 'sm' \| 'md'` | Pill badge with soft neon glow dot for jumper status and KOT kitchen dispatch status. |
| `GlassTabs` | `tabs: { id, label, icon, badge? }[]`<br/>`activeTab: string`<br/>`onChange: (id) => void` | Floating pill tab navigation with smooth active indicator highlight. |
| `GlassChips` | `options: { value, label, subtext? }[]`<br/>`value: any`<br/>`onChange: (value) => void` | Quick-tap chips for 30m/60m/90m duration, socks quantity counter, and table selection. |

---

## 4. Endpoints & Server Actions Blueprint

### Admission & Frontdesk
- `actionCreateAdmission(formData)`: Validates phone, guardian, children names, selected rate plan, and adds socks items.
- `actionPrintSticker(visitId)`: Returns formatted thermal label payload (40x30mm or 58mm wristband).

### Floor Radar & Timer
- `actionExtendPlay(visitId, minutes)`: Appends a new play block, recalculates `paidUntil`, and notifies floor staff.
- `actionLeaveOnTime(visitId)`: Closes play session without overtime if within the 5-minute grace tolerance.
- `actionWaiveOvertime(visitId, reason)`: Waives overtime fees with staff audit logging.

### F&B & Kitchen KOT
- `actionFireKot(visitId, lineIds[], tableNo)`: Sets `firedQty`, emits kitchen order event, and triggers kitchen audio chime.
- `actionBumpKotItem(lineId, nextStatus)`: Advances kitchen ticket status (`fired` -> `preparing` -> `ready` -> `delivered`).

### Cashier Settlement
- `actionGenerateDynamicEmv(amountNu, billCode)`: Produces RMA Bhutan EMV QR payload.
- `actionScanBankVoucher(imageBase64)`: Runs OCR extraction for journal number, amount, and bank.
- `actionSettleVisit(visitId, tenders, journalRef, bankName)`: Commits transaction, marks visit `settled`, writes receipt sequence, and fires payment chime.
