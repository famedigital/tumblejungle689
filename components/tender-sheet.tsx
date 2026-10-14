"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { PayQr } from "@/components/pay-qr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BankPick } from "@/components/bank-pick";
import { formatNu, formatPhone, tableLabel } from "@/lib/format";
import { bankFromJournal } from "@/lib/pay-banks";
import { isPoleJournal, POLE_CHANNEL } from "@/lib/pole";

export type TenderMethod = "cash" | "bank_qr" | "split";

export function TenderSheet({
  action,
  method,
  onMethod,
  onScan,
  amountNu,
  staticPayload,
  note,
  onClose,
  onPrint,
  customer,
  bill,
  journalScan = false,
  shop = "",
  account = "",
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  method: TenderMethod;
  onMethod: (method: TenderMethod) => void;
  onScan: (amountNu: number) => void;
  amountNu: number;
  staticPayload: string;
  note: string;
  onClose: () => void;
  onPrint?: () => void;
  customer?: { name: string; phone: string; children: number } | null;
  bill?: { code: string; lines: number; items: number; table: string; walkIn: boolean } | null;
  journalScan?: boolean;
  shop?: string;
  account?: string;
  children?: ReactNode;
}) {
  const [cashDraft, setCashDraft] = useState("");
  const [journal, setJournal] = useState("");
  const [payBank, setPayBank] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const journalRef = useRef<HTMLInputElement>(null);
  const cashRef = useRef<HTMLInputElement>(null);
  const cashNu = Math.max(0, Math.round(Number(cashDraft) || 0));
  const bankNu = method === "bank_qr" ? amountNu : method === "split" ? amountNu - cashNu : 0;
  const splitReady = method !== "split" || (cashNu > 0 && bankNu > 0 && cashNu + bankNu === amountNu);
  const journalReady = bankNu <= 0 || journal.trim().length > 0;
  const bankNamed = bankNu <= 0 || Boolean(payBank);
  const bankReady = (bankNu <= 0 || Boolean(staticPayload)) && journalReady && bankNamed;
  const title = bill?.walkIn
    ? tableLabel(bill.table)
    : customer && customer.phone.length === 8
      ? formatPhone(customer.phone)
      : customer?.name.trim() || "Guest";
  const detail = [
    bill && !bill.walkIn ? (bill.table ? tableLabel(bill.table) : "") : "",
    bill && bill.items > 0 ? `${bill.items} ${bill.items === 1 ? "item" : "items"}` : "",
    !bill && customer && customer.children > 0 ? `${customer.children} ${customer.children === 1 ? "child" : "children"}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  useEffect(() => {
    onScan(Math.max(0, bankNu));
  }, [bankNu, onScan]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
      const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        event.stopPropagation();
        const methods: TenderMethod[] = ["bank_qr", "cash", "split"];
        const index = Math.max(0, methods.indexOf(method));
        const step = event.key === "ArrowRight" ? 1 : -1;
        onMethod(methods[(index + step + methods.length) % methods.length]!);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        if (bankNu > 0 && !journal.trim()) {
          journalRef.current?.focus();
          return;
        }
        const button = formRef.current?.querySelector('button[type="submit"]');
        if (button instanceof HTMLButtonElement && !button.disabled) formRef.current?.requestSubmit(button);
        return;
      }
      if (typing) return;
      const key = event.key.toLowerCase();
      if (key === "b" || key === "1") {
        event.preventDefault();
        onMethod("bank_qr");
      } else if (key === "c" || key === "2") {
        event.preventDefault();
        onMethod("cash");
      } else if (key === "s" || key === "3") {
        event.preventDefault();
        onMethod("split");
      } else if (key === "p" && onPrint) {
        event.preventDefault();
        onPrint();
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [method, onMethod, onPrint, bankNu, journal]);

  useEffect(() => {
    if (method === "bank_qr") journalRef.current?.focus();
    if (method === "split") cashRef.current?.focus();
  }, [method]);

  useEffect(() => {
    if (!journalScan || typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(POLE_CHANNEL);
    channel.onmessage = (event) => {
      if (!isPoleJournal(event.data)) return;
      setJournal(event.data.ref);
      const found = bankFromJournal(event.data.ref);
      if (found) setPayBank(found);
    };
    return () => channel.close();
  }, [journalScan]);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="overflow-hidden sm:max-w-2xl" showCloseButton>
        <form ref={formRef} action={action} data-till-tender="" className="grid items-start gap-4 sm:grid-cols-[minmax(0,1fr)_16.5rem]">
          {children}
          <input type="hidden" name="method" value={method} />
          <input type="hidden" name="cashNu" value={method === "split" ? cashNu : 0} />
          <input type="hidden" name="bankNu" value={method === "split" ? Math.max(0, bankNu) : 0} />
          <input type="hidden" name="journal" value={bankNu > 0 ? journal : ""} />
          <input type="hidden" name="payBank" value={bankNu > 0 ? payBank : ""} />
          <div className="grid content-start gap-3">
            <DialogHeader className="gap-0">
              <DialogTitle>Tender</DialogTitle>
              <DialogDescription>Left and right change Bank, Cash, or Split. B, C, and S do the same. Enter types the journal number, then prints the receipt.</DialogDescription>
            </DialogHeader>
            <Card size="sm" className="gap-1">
              <CardHeader className="items-center">
                <CardTitle>{title}</CardTitle>
                <CardDescription>{detail}</CardDescription>
                {bill ? (
                  <CardAction>
                    <Badge variant="outline" className="font-mono">
                      {bill.code}
                    </Badge>
                  </CardAction>
                ) : null}
              </CardHeader>
            </Card>
            <Tabs value={method} onValueChange={(value) => onMethod(value as TenderMethod)}>
              <TabsList className="grid h-8 w-full grid-cols-3">
                <TabsTrigger value="bank_qr">Bank · B</TabsTrigger>
                <TabsTrigger value="cash">Cash · C</TabsTrigger>
                <TabsTrigger value="split">Split · S</TabsTrigger>
              </TabsList>
            </Tabs>
            {method === "split" ? (
              <Field label="Cash taken" hint={splitHint(cashNu, bankNu, amountNu)}>
                <Input
                  ref={cashRef}
                  inputMode="numeric"
                  autoComplete="off"
                  value={cashDraft}
                  placeholder="0"
                  className="h-9"
                  onChange={(event) => setCashDraft(event.target.value.replace(/\D/g, ""))}
                />
              </Field>
            ) : null}
            {method === "cash" ? <p className="text-sm text-muted-foreground">Count the cash, then confirm.</p> : null}
            {bankNu > 0 ? (
              <>
                <Field label="Journal number" hint={journalScan ? "The customer screen can fill this. 126- is MBOB." : "From the bank SMS. 126- is MBOB."}>
                  <Input
                    ref={journalRef}
                    value={journal}
                    autoComplete="off"
                    className="h-9"
                    placeholder="126-…"
                    onChange={(event) => {
                      const next = event.target.value.slice(0, 40);
                      setJournal(next);
                      const found = bankFromJournal(next);
                      if (found) setPayBank(found);
                    }}
                  />
                </Field>
                <BankPick value={payBank} onChange={setPayBank} />
              </>
            ) : null}
            {bankNu > 0 && !journalReady ? <Badge variant="destructive">Type the journal number.</Badge> : null}
            {bankNu > 0 && journalReady && !payBank ? <Badge variant="destructive">Pick the bank.</Badge> : null}
            {method === "split" && !splitReady ? <Badge variant="destructive">Cash and bank must add up to the due.</Badge> : null}
            <Confirm disabled={!bankReady || !splitReady || amountNu <= 0} bank={method === "bank_qr"}>
              {method === "split" ? "Take split · Enter" : method === "cash" ? `Take cash ${formatNu(amountNu)} · Enter` : `Bank received ${formatNu(bankNu)} · Enter`}
            </Confirm>
          </div>
          <aside className="flex flex-col items-center gap-2 rounded-xl bg-card px-3 pt-8 pb-3 text-center ring-1 ring-foreground/15">
            {bankNu > 0 ? (
              <div className="rounded-xl bg-white p-2 shadow-sm ring-2 ring-neutral-950">
                <PayQr staticPayload={staticPayload} amountNu={bankNu} note={note} strong showAmount={false} />
              </div>
            ) : null}
            <p className="text-2xl font-medium tracking-tight text-primary tabular-nums">{formatNu(bankNu > 0 ? bankNu : amountNu)}</p>
            {account ? <p className="font-mono text-xs break-all">{account}</p> : null}
            {shop ? <p className="text-sm font-medium">{shop}</p> : null}
          </aside>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function splitHint(cashNu: number, bankNu: number, amountNu: number): string {
  if (bankNu > 0 && cashNu + bankNu === amountNu) return `Bank QR ${formatNu(bankNu)}. Cash stays in the till.`;
  if (cashNu > amountNu) return "Cash is more than the bill.";
  return "Enter the cash. The rest goes on the bank QR.";
}

function Confirm({ children, disabled, bank }: { children: ReactNode; disabled: boolean; bank: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={bank ? "secondary" : "default"} className="h-12 text-base" disabled={pending || disabled}>
      {pending ? "Taking payment…" : children}
    </Button>
  );
}
