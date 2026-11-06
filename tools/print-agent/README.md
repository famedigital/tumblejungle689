# Tumble print agent

Run this on the **Windows PC** that owns the shared receipt printer. Phones on the same WiFi send print jobs here; the agent talks to the thermal printer.

## 1. Install / start (on the printer PC)

```bat
cd tools\print-agent
copy .env.example .env
notepad .env
npm start
```

Leave this window open while the venue is open (or install as a startup task).

## 2. Configure `.env`

| Variable | Meaning |
|----------|---------|
| `PORT` | LAN port (default `7910`) |
| `TOKEN` | Shared secret (same as Admin → Print station) |
| `PRINTER_HOST` | Printer IP if it has Ethernet/WiFi (raw port `9100`) |
| `PRINTER_NAME` | Windows printer name if USB (leave `PRINTER_HOST` empty) |

Find the PC’s WiFi IP: `ipconfig` → IPv4, e.g. `192.168.1.20`.

## 3. Point the till

In **Admin → Public page** (Print station):

- URL: `http://192.168.1.20:7910`
- Token: same as `.env` `TOKEN`

Or on any till browser DevTools / local override via the Print station fields once saved server-side.

## 4. Test

- Browser on the PC: open `http://127.0.0.1:7910/health`
- Phone on WiFi: open `http://PC-IP:7910/health` (must load JSON)
- Print a receipt from a phone till — should come out on the shared printer

## Firewall

Allow inbound **TCP 7910** on the PC (Windows Defender Firewall) for Private networks.

## Notes

- No cloud dependency — phones talk to the PC on LAN only.
- If the agent is down, the till falls back to the normal browser print dialog.
- Do not expose this port to the public internet.
