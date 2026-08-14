# 12 — Conectar Hostinger (capacidad 🔌)

Leave the person's Hostinger account connected so their hosting can be managed
(publish sites, domains, etc.). Autonomous capability: if they only asked to
connect, do this, verify, and **stop**.

> **Idioma y tono (obligatorio en toda la skill):** todo lo que le digas al
> usuario va **en castellano** y **sin jerga** (nunca "MCP", "CLI", "stdio",
> "npm", "OAuth", "token", "variable de entorno"). Di "el conector de Hostinger",
> "preparar tu ordenador", "conectar tu cuenta", "comprobar que funciona". Todos
> los comandos los ejecutas tú; **lo único** que toca el usuario es **un clic de
> login** en su navegador. Anuncia antes de cada paso visible, celebra el logro
> (✅) y jamás le muestres un error en crudo — si algo falla, tradúcelo a un
> "estoy afinando un detalle, dame un momento". Este fichero es técnico porque lo
> lees TÚ; la experiencia del usuario no lo es.

---

## What "connected" really means here (read this first)

The connector (`hostinger-api-mcp`) is a **local** MCP server installed on the
person's computer. There are **two very different runtimes**, and it changes
everything:

- **Claude Code CLI** (a real `claude` on PATH): you register the connector with
  `claude mcp add --scope user …` and, in a *new* session, its tools appear in
  your toolset. Classic path.
- **Claude Desktop app / local-agent mode** (very common — this is where you
  probably are): there is usually **no `claude` command on PATH**, and MCP
  servers load at app start, so a connector you register mid-session is **not**
  usable in this same session.

**Therefore, for the purpose that matters most (🚀 publishing), "connected" does
not require `claude mcp add` at all.** It requires exactly two things:

1. the connector **installed** (`npm install -g hostinger-api-mcp`), and
2. the **browser login done once** (`hostinger-hosting-mcp --login` → credentials
   stored on disk).

With those two, you can publish **right now, in the same turn**, by driving the
connector over stdio (see `reference/13-hostinger-deploy.md`). Don't get stuck
hunting for a `claude` CLI that isn't there.

---

## Paso A — Preparar el ordenador

1. Detect the OS. Run the diagnostic (don't check by hand):
   Windows `scripts/diagnostico.ps1` · macOS/Linux `scripts/diagnostico.sh`.
   It reports Node version (**needs 24+**), whether `hostinger-api-mcp` is
   installed, and whether a `claude` CLI exists (`claude: NOT_FOUND` is normal in
   the Desktop app — not a problem, see above).
2. If Node is missing or < 24, install it yourself with the first method that
   works: **nvm** (preferred on Mac/Linux: `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash && nvm install 24 && nvm use 24`),
   else the system manager (`winget install OpenJS.NodeJS.LTS` on Windows,
   `brew install node@24` on Mac), else the official installer from nodejs.org.
   On Windows you may need to re-check the diagnostic after install for PATH to
   pick `node` up — verify, don't assume.
3. Install the connector: `npm install -g hostinger-api-mcp`. It drops one binary
   per Hostinger area next to Node. Find where with `npm prefix -g` — on
   winget-Node that's e.g.
   `C:\Users\<u>\AppData\Local\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_..._8wekyb3d8bbwe\node-v24.15.0-win-x64\`,
   and the one you want is `hostinger-hosting-mcp.cmd` there.

Only if nvm, the system manager AND the official installer all fail do you ask
the user for help — one plain sentence pointing to nodejs.org/en/download/.

---

## Paso B — Qué quiere gestionar (infiérelo; una sola pregunta si hace falta)

If they told you the purpose ("subir mi web", "gestionar dominios"), **infer the
area and don't ask again**. To **publish websites** (🚀) the area is **Sitios
web** → the binary `hostinger-hosting-mcp`. Other areas exist
(`hostinger-domains-mcp`, `hostinger-vps-mcp`, `hostinger-ecommerce-mcp`,
`hostinger-reach-mcp`, `hostinger-billing-mcp`, or the unified `hostinger-api-mcp`)
but you rarely need more than one or two.

---

## Paso C — Conectar la cuenta (the browser login = the ONE user action)

Trigger the login yourself with the full path to the binary. **No token, no
env var** — OAuth by browser is simpler. Run it (background it if you like) and
read its stdout for the URL:

```
"<binpath>\hostinger-hosting-mcp.cmd" --login
```

It prints:

```
[OAuth] Opening browser for sign-in:
  https://auth.hostinger.com/api/external/v1/oauth-server/authorize?client_id=…&redirect_uri=http%3A%2F%2F127.0.0.1%3A<port>%2Foauth%2Fcallback&…
[OAuth] If the browser does not open, copy the URL above into one manually.
```

Tell the user exactly this, in Spanish, and nothing more:
> "Se va a abrir tu navegador. 1) Inicia sesión con tu cuenta de Hostinger.
> 2) Pulsa **Autorizar**. 3) Vuelve aquí — yo detecto cuándo terminas."

If the browser doesn't open, hand them the printed URL. The command **exits by
itself** once they authorize, printing:

```
[OAuth] Sign-in successful. Credentials stored.
```

Credentials are **shared across all hostinger binaries and persist**, so you log
in **once** even if you use several areas, and the stdio-driven connector (🚀)
picks them up automatically — nothing else to wire.

### Optional: register in the app for native, in-session tools (only if wanted)

If a real `claude` CLI exists, register for future sessions:
`claude mcp add --transport stdio hostinger-hosting --scope user -- cmd /c "<binpath>\hostinger-hosting-mcp.cmd"`.
In the plain Desktop app the equivalent is adding an entry under `mcpServers` in
`%APPDATA%\Claude\claude_desktop_config.json` and **restarting the app** — the
new tools only appear after a restart. Neither is required to publish today; skip
unless the user wants one-click publishing later.

---

## Paso D — Verificar antes de dar nada por hecho (con una llamada real)

Don't claim success from "the login exited ok". Make a **real read-only call** and
confirm it returns real data. In the Desktop app you can't use `claude mcp list`,
so verify by a **10-line stdio call** to the connector (same transport as 🚀):

```js
// verify.mjs  →  node verify.mjs   (prints the account's real websites/orders)
import { spawn } from "node:child_process";
const BIN = "<binpath>\\hostinger-hosting-mcp.cmd";
const c = spawn("cmd.exe", ["/c", BIN, "--stdio"], { stdio: ["pipe","pipe","inherit"] });
let buf=""; const P=new Map(); let id=0;
c.stdout.on("data",d=>{buf+=d;let i;while((i=buf.indexOf("\n"))>=0){const l=buf.slice(0,i).trim();buf=buf.slice(i+1);let m;try{m=JSON.parse(l)}catch{continue}if(P.has(m.id)){P.get(m.id)(m.result);P.delete(m.id)}}});
const rpc=(method,params)=>new Promise(r=>{const i=++id;P.set(i,r);c.stdin.write(JSON.stringify({jsonrpc:"2.0",id:i,method,params})+"\n")});
await rpc("initialize",{protocolVersion:"2024-11-05",capabilities:{},clientInfo:{name:"v",version:"1"}});
c.stdin.write(JSON.stringify({jsonrpc:"2.0",method:"notifications/initialized",params:{}})+"\n");
const r=await rpc("tools/call",{name:"hosting_listWebsitesV1",arguments:{}});
console.log((r.content||[]).map(x=>x.text).join("\n")); c.kill(); process.exit(0);
```

Real data back (a `{"data":[…]}` of sites or an empty list on a fresh plan) = the
connection works. If it fails with an auth error, re-run `--login` (most common
cause). Only then tell the user, in Spanish: "✅ Tu cuenta de Hostinger ya está
conectada — puedo subir y publicar tus webs cuando quieras."

---

## Solución de problemas

- **`claude: command not found`** — normal in the Desktop app; do **not** chase a
  CLI. Use the stdio path (🚀 and the verify snippet above) which needs no CLI.
- **`npm install -g` EACCES** — Node came from a system installer; reinstall Node
  via nvm and retry (never `sudo`).
- **Node still old after "updating"** — several Nodes installed; re-run the
  diagnostic, trust it over memory.
- **Browser didn't open after `--login`** — open the printed URL yourself / hand
  it to the user.
- **Login ok but verify fails** — re-run `--login`; if it still fails the account
  may lack that area's permission (e.g. no hosting plan). Confirm before assuming
  the connector is broken.
- **Accented project paths** (e.g. `…/prospección/…`) break *Playwright/Chromium
  browser spawns* but NOT Node file ops or the connector — those are fine.

---

## Reglas de oro de la conexión

1. Never ask the user to open a terminal or paste commands — the only exception is
   the browser login click.
2. Install Node yourself if missing; only send a download link if all three
   automatic methods failed.
3. Prefer OAuth browser login over a manual token.
4. Never claim "done" without a real read-only call (Paso D) that returns data.
5. Todo al usuario **en castellano y sin tecnicismos**; los detalles técnicos son
   solo para ti.
