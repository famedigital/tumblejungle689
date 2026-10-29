"use client";

import { useState } from "react";
import { saveReceiptAction } from "@/app/actions";
import { Receipt } from "@/components/receipt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const SAMPLE = [
  { name: "Play 60 min", qty: 1, amount: 350, paid: true },
  { name: "Milk tea", qty: 2, amount: 80, paid: false },
];

export function ReceiptEditor({
  venue,
  address,
  note,
  thanks,
  rules,
}: {
  venue: string;
  address: string;
  note: string;
  thanks: string;
  rules: string;
}) {
  const [draftNote, setDraftNote] = useState(note);
  const [draftThanks, setDraftThanks] = useState(thanks);
  const [draftRules, setDraftRules] = useState(rules);
  const ruleLines = draftRules.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  return (
    <section className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <form action={saveReceiptAction} className="space-y-4 rounded-3xl bg-card p-5 ring-1 ring-foreground/10">
        <input type="hidden" name="back" value="/admin/receipt" />
        <div>
          <h2 className="font-heading text-2xl">Receipt</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            This text is printed under every bill. Put one house rule on each line.
          </p>
        </div>
        <label className="block space-y-1 text-sm">
          <span>Line under the address</span>
          <Input name="note" value={draftNote} onChange={(event) => setDraftNote(event.target.value)} className="h-11" placeholder="Changjiji, Thimphu" />
        </label>
        <label className="block space-y-1 text-sm">
          <span>Thank you line</span>
          <Input name="thanks" value={draftThanks} onChange={(event) => setDraftThanks(event.target.value)} className="h-11" />
        </label>
        <label className="block space-y-1 text-sm">
          <span>Rules</span>
          <Textarea
            name="rules"
            value={draftRules}
            onChange={(event) => setDraftRules(event.target.value)}
            rows={8}
            placeholder={"Socks on in the play pit\nParents stay with the children\nFood is paid before you leave"}
          />
        </label>
        <Button type="submit" className="h-11">
          Save receipt
        </Button>
      </form>
      <div className="receipt-preview">
        <Receipt
          venue={venue}
          address={address}
          note={draftNote}
          when="30 Sep, 11:20"
          code="SAMPLE"
          phone="7777 8989"
          lines={SAMPLE}
          total={430}
          cash={150}
          bank={280}
          banks={[{ name: "MBOB", ref: "126-88412031", amount: 280 }]}
          thanks={draftThanks}
          rules={ruleLines}
          number={128}
        />
      </div>
    </section>
  );
}
