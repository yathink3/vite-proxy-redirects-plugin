# 🔁 vite-proxy-redirects-plugin

A powerful [Vite](https://vitejs.dev) plugin for **dynamic dev proxying** and **build-time redirect generation** based on environment variables.

Supports:

* **Vite dev server proxy rewrites** (`vite serve`)
* **Netlify-style** `_redirects` output
* **Vercel-style** `vercel.json` output
  ... based on detected platform or override.

---

## 📦 Installation

```bash
npm install vite-proxy-redirects-plugin --save-dev
```

---

## ⚙️ Usage

### 1. Add to `vite.config.js`

```js
import redirectsUpdate from 'vite-proxy-redirects-plugin';

export default {
  plugins: [
    redirectsUpdate({
      templateFile: 'redirects.template',      // optional, defaults to 'redirects.template'
      deployPlatform: 'netlify'                // optional, defaults to 'netlify', override: 'netlify' | 'vercel'
    })
  ]
};
```

---

### 2. Set environment variables

```env
BASE_PROXY_URL=https://api.example.com
AUTH_URL=https://auth.example.com
```

---

### 3. Create `redirects.template` in root

```txt
# Format: [source_path] [target_url]
/api/* {{BASE_PROXY_URL}}/v1/
/auth/* {{AUTH_URL}}/login/
/admin/* {{ADMIN_URL}}/dashboard/
```

> ⚠️ Lines with missing `{{VAR}}` are skipped automatically.

---

## 🧠 Platform Detection

This plugin detects the deploy environment automatically via:

* `process.env.DEPLOY_PLATFORM=netlify|vercel`
* or CI-specific variables:

  * `VERCEL=1`
  * `NETLIFY=true`

---

## 🛠 Behavior Overview

### 🔧 Development (`vite serve`)

* Loads `redirects.template`
* Replaces `{{VAR}}` with `.env` values
* Skips invalid/missing lines
* Applies proxy rewrites to `vite.config.server.proxy`
* Logs each mapping

---

### 📦 Production (`vite build`)

* Resolves `{{VAR}}` in each rule
* Based on detected or configured platform:

  * Writes `public/_redirects` for Netlify
  * Writes `vercel.json` for Vercel
* Skips lines with unresolved env vars
* Logs each rewrite

---

## 🧪 Example

**redirects.template**:

```txt
/api/* {{BASE_PROXY_URL}}/v1/
/auth/* {{AUTH_URL}}/login/
/skip/* {{UNDEFINED}}/noop/
```

**.env**:

```env
BASE_PROXY_URL=https://api.example.com
AUTH_URL=https://auth.example.com
```

**Output (vite)**:

```json
vite.config:
{
  "proxy": {
    "/api/": {
      target: "https://api.example.com",
      changeOrigin: true,
      secure: false,
      rewrite: p => p.replace(/^\/api/, "/v1/")
    },
    "/auth/": {
      target: "https://auth.example.com",
      changeOrigin: true,
      secure: false,
      rewrite: p => p.replace(/^\/auth/, "/login/")
    }
  }
}
```

**Output (Netlify)**:

```
public/_redirects:
  /api/* https://api.example.com/v1/
  /auth/* https://auth.example.com/login/
```

**Output (Vercel)**:

```json
vercel.json:
{
  "redirects": [
    {
      "source": "/api/*",
      "destination": "https://api.example.com/v1/",
      "permanent": true
    },
    {
      "source": "/auth/*",
      "destination": "https://auth.example.com/login/",
      "permanent": true
    }
  ]
}
```

---

## 🧩 Template Syntax

* Lines beginning with `#` are comments
* Use `{{VAR}}` for dynamic replacement
* Supports wildcards: `/api/*`
* Auto-rewrites path differences in dev proxy
* Skips malformed or undefined routes

---

## 📜 License

MIT
