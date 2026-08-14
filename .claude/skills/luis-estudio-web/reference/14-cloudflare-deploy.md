# Deploying to Cloudflare Pages

This reference guides the 🚀 **Publish (Cloudflare)** capability. You use this when the user chooses to publish their static website to Cloudflare instead of Hostinger.

Cloudflare Pages is a lightning-fast, free host for static sites. We use the official `wrangler` CLI via `npx` to deploy directly from the project directory.

---

## 1. Prerequisites Check

Before deploying, ensure:
1. The project exists and is a valid static site (has `index.html`).
2. Node.js is installed (`npx` must be available). Check with `npx --version`.

## 2. The Deployment Flow

Always execute these steps sequentially using your bash tool.

### Step A: Ensure Wrangler is authenticated

Wrangler requires the user to log in via the browser the first time.
Run:
```bash
npx wrangler whoami
```
- If it says "You are logged in", proceed to Step B.
- If it fails or says you are not logged in, you MUST ask the user to log in. Tell them: "Necesito que inicies sesión en Cloudflare. Voy a abrir tu navegador. Por favor, haz clic en Permitir (Allow) y avísame cuando hayas terminado."
Then run `npx wrangler login` (this will hang waiting for browser input). Once the user confirms they logged in, verify again with `npx wrangler whoami`.

### Step B: Deploy the project

Navigate to the project directory where `index.html` lives (e.g. `cazas/mi-proyecto/`).
Run the deploy command. Wrangler will automatically create the project in Cloudflare Pages if it doesn't exist, using the folder name as the project name.

```bash
cd cazas/[nombre-del-proyecto]
npx wrangler pages deploy . --project-name [nombre-del-proyecto]
```
*(Replace `[nombre-del-proyecto]` with a URL-safe version of the project name: lowercase, no spaces, hyphens only).*

### Step C: Verify and Report

Read the output from the `wrangler` command. It will provide a live URL, typically looking like `https://[nombre-del-proyecto].pages.dev`.

Send a curl request to ensure it returns HTTP 200:
```bash
curl -I https://[nombre-del-proyecto].pages.dev
```

Once verified, present the URL to the user enthusiastically!

## 3. Communication rules for this capability

- **No jargon**: Do not mention "wrangler", "npx", "CLI", or "terminal".
- **Clear steps**: Tell the user "Estoy preparando tu web para Cloudflare...", "Subiendo los archivos...", "¡Lista!".
- **Login help**: If the browser login hangs or fails, offer the fallback login `npx wrangler login --browser=false` and give them the link to paste in their browser manually.
