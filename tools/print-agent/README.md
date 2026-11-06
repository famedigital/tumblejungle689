# Tumble print agent

Run on the **Windows PC** that owns the receipt printer. Phones use the normal HTTPS till; the agent **pulls** print jobs from the cloud (browsers block phone→LAN printer from HTTPS pages).

## Why not “same WiFi URL”?

The till is `https://…`. Browsers refuse to call `http://192.168.x.x` from that page (mixed content). So the PC agent calls out to the site instead — **no firewall port to open**.

## Setup (printer PC)

1. Install [Node.js LTS](https://nodejs.org) (one-time).
2. Copy this `print-agent` folder to the PC (USB is fine), e.g. `C:\tumble-print-agent`.
3. In Command Prompt:

```bat
cd C:\tumble-print-agent
copy .env.example .env
notepad .env
npm start
```

4. In `.env` set:
   - `CLOUD_URL=https://tumblejungle689.vercel.app`
   - `TOKEN=` same as Admin → **Receipt / Print**
   - `PRINTER_HOST=` printer IP **or** `PRINTER_NAME=` Windows USB printer name

5. Leave the black window open while open.

6. Admin → **Receipt / Print** → tick **Send till prints to the shared printer PC** → Save → **Test agent** (should say online within a few seconds).

## Test

Print any receipt from a phone till. The agent window should log `Printing job #…` and the slip should come out.
