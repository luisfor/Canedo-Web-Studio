# 13 — Publish a static site to Hostinger (capacidad 🚀)

Put a finished static site **live on Hostinger** using the connection from
capability 🔌 (`reference/12-hostinger-connect.md`). Independent capability: run
it only when the user asks to publish/upload, verify the live URL, and stop.

> **Idioma y tono (obligatorio en toda la skill):** háblale al usuario **en
> castellano** y **sin una sola palabra técnica**. Este documento es para ti (el
> LLM) y es técnico a propósito; lo que le llega al usuario NO. Él solo ve frases
> como "voy a publicar tu web, tarda unos segundos" y, al final, el enlace. Nunca
> le enseñes comandos, nombres de herramientas, ni errores en crudo. Lo único que
> hace él con sus manos es **un clic de login** en el navegador (paso 🔌).

---

## TL;DR — the method that actually works (read this first)

This skill usually runs **inside the Claude Desktop app**, where there is **no
`claude` CLI on PATH** and MCP servers are loaded at app start. So the classic
"register with `claude mcp add` and call the tools from your session" path often
**does not apply** — the freshly registered connector's tools won't be in your
current toolset.

**The reliable, universal path (works in the same turn, no restart, no CLI):**
after the user has done the browser login once (🔌), **drive the Hostinger
connector directly over MCP stdio with a tiny Node script.** The connector is an
MCP stdio server; you spawn it, speak JSON-RPC, and call its hosting tools. It
authenticates automatically with the stored OAuth credentials. This is how the
deploy in the reference session succeeded end-to-end.

The whole publish is 5 connector tool calls:
`generateAFreeSubdomain` → `listOrders`/`listWebsites` (get `order_id`) →
`createWebsiteV1` (async) → poll `listWebsitesV1` until the domain appears →
`deployStaticWebsite` → then HTTP-verify the live URL.

---

## Prerequisites (all from 🔌, `reference/12-hostinger-connect.md`)

1. **Node.js 24+** installed. `node` is on PATH even if the connector isn't.
2. Connector installed: `npm install -g hostinger-api-mcp` (installs one binary
   per area; you want `hostinger-hosting-mcp`).
3. **OAuth login done**: `hostinger-hosting-mcp --login` → user authorized →
   prints `[OAuth] Sign-in successful. Credentials stored.` Credentials are shared
   across all hostinger binaries and persist, so the stdio-driven server just uses
   them — no token, no env var needed.

Find the binary's absolute path (winget-installed Node puts globals next to node):

```
npm prefix -g      # e.g. C:\Users\<u>\AppData\Local\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_..._8wekyb3d8bbwe\node-v24.15.0-win-x64
# the connector is:  <that path>\hostinger-hosting-mcp.cmd
```

---

## The connector's real tool names (use EXACT names — substring matching bites)

The `hostinger-hosting-mcp` server exposes ~41 tools. The ones you need:

| Tool (exact) | Args | Returns / notes |
|---|---|---|
| `hosting_generateAFreeSubdomainV1` | `{}` | `{"domain":"<random>.hostingersite.com"}` |
| `hosting_listWebsitesV1` | `{}` | `{"data":[{domain, order_id, username, …}]}` — existing sites; also a source of `order_id` |
| `hosting_listOrdersV1` | `{}` | `{"data":[{"id":<order_id>, "plan":{…}, "status":"active"}]}` — `id` **is** the `order_id` |
| `hosting_listAvailableDatacentersV1` | `{}` | datacenter list; read a `code` for `datacenter_code` |
| `hosting_createWebsiteV1` | `{domain, order_id:int, datacenter_code?}` | `{"message":"Request accepted"}` — **async** (see below) |
| `hosting_deployStaticWebsite` | `{domain, archivePath, removeArchive?}` | `{"upload":{status:"success"}, "deploy":{status:"success"}}` |

**⚠️ Exact-name trap.** Never resolve tools by "includes(substring)". These
collide and will silently pick the WRONG tool:
- `"listwebsites"` ⊂ `hosting_listWebsite**Subdomains**V1` (wrong) vs `hosting_listWebsitesV1` (right).
- `"createwebsite"` ⊂ `hosting_createWebsite**ParkedDomain**V1` (wrong) vs `hosting_createWebsiteV1` (right).
Match by **exact equality** (`t.name === "hosting_createWebsiteV1"`). In the
reference session, substring matching created a *parked domain* instead of a
website and the deploy then failed with `No website found for domain`.

**Tool results are wrapped.** Each result is `{content:[{type:"text", text:"<json string>"}]}`.
Join the `text` parts and `JSON.parse` (or regex-extract) what you need.

---

## Two flows

### A. Temporary domain (demos, previews — the default ask)

1. `hosting_generateAFreeSubdomainV1` → grab the `*.hostingersite.com` domain.
2. `order_id`: call `hosting_listOrdersV1` and read `data[0].id` (or read
   `order_id` off any site in `hosting_listWebsitesV1`). It is an **integer**.
3. `hosting_createWebsiteV1 {domain, order_id}` → `"Request accepted"` (async).
   If it errors mentioning **datacenter** (only happens on the *first* website of
   a brand-new plan), call `hosting_listAvailableDatacentersV1`, take a `code`,
   retry with `{domain, order_id, datacenter_code}`.
4. **Poll** `hosting_listWebsitesV1` every ~6 s until its text contains the
   domain (usually 1–3 polls). THEN deploy — see the async gotcha.
5. `hosting_deployStaticWebsite {domain, archivePath}`.
6. HTTP-verify the live URL.

### B. The user's own domain

The site usually already exists on the account. Confirm with
`hosting_listWebsitesV1`; if the domain is listed, **skip create** and go
straight to `hosting_deployStaticWebsite`. If not, create it (or point them to
Hostinger's domain setup).

---

## The async-creation gotcha (the one that bit us)

`hosting_createWebsiteV1` returns `"Request accepted"` immediately but provisions
a few seconds later. Deploying too soon fails with:

> `No website found for domain: <domain>`

**Fix:** after creating, poll `hosting_listWebsitesV1` until the domain appears
(cap ~72 s), *then* deploy. Do **not** gate this on a "created" flag you set
optimistically — verify by reading `listWebsitesV1`, because a wrong/failed
create can leave a stale flag and make you skip straight to a failing deploy.

---

## Packaging the site (get this exactly right)

`hosting_deployStaticWebsite` uploads a **zip** and extracts it into the web
root. So:

- **`index.html` must sit at the ROOT of the archive** (zip the folder's
  *contents*, not the folder). If the finished file is named something else
  (e.g. `dashboard.html`), copy it to `index.html` in a staging folder first.
- **Include `.htaccess`** (`templates/htaccess.template` → `.htaccess`). On
  Windows, `Compress-Archive -Path "staging\*"` **does** include dotfiles —
  verify the archive lists `.htaccess`.
- **Exclude working/secret files** (the OpenAI key + source photos in the sibling
  `{project}-ia/` folder; heavy `assets/photos/source/`). Stage only what the
  site serves.
- **Stage the zip INSIDE the project folder, not in a temp dir.** Writing/removing
  archives under the OS temp path (`%TEMP%`, the scratchpad) can trip a
  removal-guard ("path is protected from removal"). The project folder is a
  trusted location; stage there.
- **`archivePath`: pass an ABSOLUTE path with FORWARD slashes**
  (`C:/Users/.../site.zip`) to avoid backslash-escaping issues.

PowerShell packaging (single self-contained HTML shown; adapt for multi-file):

```powershell
$root  = "C:\...\project"
$stage = "$root\deploy_pkg\site"
$zip   = "$root\deploy_pkg\site.zip"
New-Item -ItemType Directory -Force -Path $stage | Out-Null
Copy-Item "$root\<finished>.html" "$stage\index.html" -Force
Copy-Item "<skill>\templates\htaccess.template" "$stage\.htaccess" -Force
Compress-Archive -Path "$stage\*" -DestinationPath $zip -Force
# verify entries include .htaccess AND index.html:
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::OpenRead($zip).Entries | ForEach-Object { $_.FullName }
```

---

## The proven driver — write this to `deploy_pkg/deploy_driver.mjs` and run with `node`

Fill in the two constants (`BIN`, `ZIP`). Re-run safe: it persists the chosen
domain + order_id in `deploy_state.json`, so a retry never orphans a second
subdomain. It resolves tools by **exact name**, handles the datacenter case,
polls for provisioning, then deploys.

```js
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const BIN = "C:\\Users\\<u>\\AppData\\Local\\Microsoft\\WinGet\\Packages\\OpenJS.NodeJS.LTS_..._8wekyb3d8bbwe\\node-v24.15.0-win-x64\\hostinger-hosting-mcp.cmd";
const DIR = "C:/Users/<u>/.../project/deploy_pkg";
const ZIP = DIR + "/site.zip";
const STATE = DIR + "/deploy_state.json";

const sleep = ms => new Promise(r => setTimeout(r, ms));
const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : {};
const saveState = () => writeFileSync(STATE, JSON.stringify(state, null, 2));

// Windows: launch the .cmd via cmd /c; default transport is stdio.
const child = spawn("cmd.exe", ["/c", BIN, "--stdio"], { stdio: ["pipe", "pipe", "pipe"] });
child.stderr.on("data", d => process.stderr.write("[conector] " + d)); // connector logs go to stderr

let buf = ""; const pending = new Map();
child.stdout.on("data", d => {                       // MCP stdio = newline-delimited JSON-RPC
  buf += d.toString("utf8"); let i;
  while ((i = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
    if (!line) continue;
    let m; try { m = JSON.parse(line); } catch { continue; } // ignore non-JSON log lines
    if (m.id !== undefined && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id); pending.delete(m.id);
      m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
    }
  }
});
let idc = 0;
const rpc = (method, params, ms = 90000) => new Promise((resolve, reject) => {
  const id = ++idc; pending.set(id, { resolve, reject });
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error("timeout " + method)); } }, ms);
});
const notify = (method, params) => child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
const txt = r => (r?.content || []).map(c => c.text || "").join("\n");

async function main() {
  await rpc("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "deploy", version: "1" } });
  notify("notifications/initialized", {});
  const tools = (await rpc("tools/list", {})).tools || [];
  const exact = n => tools.find(t => t.name === n);              // EXACT names only
  const call = (name, args) => rpc("tools/call", { name, arguments: args || {} });
  const subT = exact("hosting_generateAFreeSubdomainV1");
  const listT = exact("hosting_listWebsitesV1");
  const ordT = exact("hosting_listOrdersV1");
  const createT = exact("hosting_createWebsiteV1");
  const deployT = exact("hosting_deployStaticWebsite");

  if (!state.domain) {                                          // 1) free subdomain (reused on retry)
    const t = txt(await call(subT.name, {}));
    state.domain = (t.match(/([a-z0-9-]+\.hostingersite\.com)/i) || [])[1];
    if (!state.domain) throw new Error("no subdomain parsed: " + t);
    saveState();
  }
  if (!state.order_id) {                                        // 2) order_id (integer)
    let t = txt(await call(ordT.name, {}));
    state.order_id = +(t.match(/"id"\s*:\s*(\d+)/) || [])[1];
    saveState();
  }
  const siteExists = async () => txt(await call(listT.name, {})).includes(state.domain);
  if (!(await siteExists())) {                                  // 3) create (async) + poll
    const args = { domain: state.domain, order_id: +state.order_id };
    try { console.log("CREATE:", txt(await call(createT.name, args))); }
    catch (e) {
      if (/datacenter/i.test(e.message)) {
        const dc = (txt(await call("hosting_listAvailableDatacentersV1", {})).match(/"code"\s*:\s*"([^"]+)"/) || [])[1];
        args.datacenter_code = dc; console.log("CREATE(dc):", txt(await call(createT.name, args)));
      } else throw e;
    }
    let ok = false;
    for (let k = 0; k < 12 && !ok; k++) { await sleep(6000); ok = await siteExists(); }
    if (!ok) throw new Error("website not provisioned in time");
  }
  console.log("DEPLOY:", txt(await call(deployT.name, { domain: state.domain, archivePath: ZIP })));  // 4) deploy
  console.log("DONE_URL: https://" + state.domain + "/");
}
main().then(() => { child.kill(); process.exit(0); })
     .catch(e => { console.error("FATAL:", e.message); child.kill(); process.exit(1); });
```

Run it (filter the connector's DEBUG noise so you can read the result):

```powershell
node "C:\...\project\deploy_pkg\deploy_driver.mjs" 2>&1 |
  Where-Object { $_ -notmatch '\[conector\] \[DEBUG\]|Request config|API Request' }
```

A success prints `DEPLOY: {"upload":{"status":"success"},"deploy":{"status":"success"…}}`
and `DONE_URL: https://<domain>/`.

---

## Verify live before telling the user it's done (invariant #11)

Fetch the URL (allow a few seconds for extraction) and confirm real content, not
a parking page:

```powershell
$html = (Invoke-WebRequest "https://<domain>/" -UseBasicParsing -TimeoutSec 30).Content
# check: status 200, a known headline/section marker, your data markers, '@media'
```

- 200 + your expected headline + a content/data marker you know is in the page.
- Note: `Invoke-WebRequest .Content.Length` is a **character** count, not bytes —
  don't compare it to the file's byte size and panic; compare markers instead.
- PowerShell pitfall: `"try $i: ..."` mis-parses `$i:` as a drive. Use `${i}` or
  string concatenation.

Only then give the user the link, in plain Spanish:
`✅ Tu web ya está online: <URL>`. Add one honest line if relevant — a free
`*.hostingersite.com` URL is **public**; if the content is sensitive, offer to
protect or remove it. Then stop (golden rule); at most one optional next-step
sentence.

---

## Redeploying to the same domain

The website already exists, so **skip create** — just re-zip and call
`hosting_deployStaticWebsite` again (the driver's `deploy_state.json` already has
the domain, so it goes straight to deploy). If you changed external CSS/JS, bump
the `?v=YYYYMMDD` cache-buster in the HTML first (invariant #2); a single
self-contained HTML file needs no cache-buster.

---

## Fallback ladder (in order)

1. **stdio driver above** — the default; needs only Node + the one-time login.
2. **`claude mcp add` + in-session tools** — ONLY if a real `claude` CLI exists
   (`where claude`). It doesn't in the plain Desktop app; don't assume it.
3. **API token, no OAuth** — set `HOSTINGER_API_TOKEN` (from hPanel → API) and run
   the connector with `--http`, or pass the token to the same tool calls. Use only
   if the browser login is impossible.
4. **Manual upload (no connection at all)** — tell the user, in plain Spanish, to
   open hPanel → *Administrador de archivos* → the `public_html` of their domain
   and drag the files in. Offer to connect and do it for them instead. Don't push.
