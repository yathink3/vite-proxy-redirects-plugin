# 🔁 vite-proxy-redirects-plugin

A powerful [Vite](https://vitejs.dev) plugin for dynamic proxy configuration during development and static `_redirects` generation during production (e.g. for Netlify). It reads route mappings from a `redirects.template` file and supports **multiple dynamic environment variable placeholders** using `{{VAR_NAME}}` syntax.

---

## 📦 Installation

```bash
npm install vite-proxy-redirects-plugin --save-dev
````

---

## ⚙️ Usage

### 1. Configure in `vite.config.js`

```js
import redirectsUpdate from 'vite-proxy-redirects-plugin';

export default {
  plugins: [
    redirectsUpdate({
      templateFile: 'redirects.template' // optional; defaults to 'redirects.template'
    })
  ]
};
```

---

### 2. Define your environment variables

```env
BASE_PROXY_URL=https://api.example.com
AUTH_URL=https://auth.example.com
```

---

### 3. Create a `redirects.template` at the root

```txt
# Format: [source_path] [target_url]
/api/* {{BASE_PROXY_URL}}/v1/
/auth/* {{AUTH_URL}}/login/
/admin/* {{ADMIN_URL}}/dashboard/
```

> ⚠️ Lines containing undefined `{{ENV_VAR}}` are automatically skipped.

---

## 🛠 How It Works

### 🧪 Development (`vite serve`)

* Loads `redirects.template`
* Replaces `{{VAR}}` with values from `.env` or `process.env`
* Skips lines with missing variables
* Configures Vite dev server proxy with automatic rewrites
* Logs each applied rule

### 📦 Production (`vite build`)

* Replaces `{{VAR}}` placeholders
* Writes result to `public/_redirects`
* Skips lines with missing env variables
* Compatible with Netlify & other static hosts

---

## 🧪 Example

**redirects.template**:

```txt
/api/* {{BASE_PROXY_URL}}/v1/
/auth/* {{AUTH_URL}}/login/
/skip/* {{UNDEFINED}}/nope/
```

**.env**:

```env
BASE_PROXY_URL=https://api.example.com
AUTH_URL=https://auth.example.com
```

**Generated `public/_redirects`**:

```txt
/api/* https://api.example.com/v1/
/auth/* https://auth.example.com/login/
```

---

## 🧩 Template Syntax

* `#` marks a comment
* Supports multiple `{{VAR}}` per line
* Wildcard paths like `/api/*` are valid
* Rewrites are added if destination path differs from source
* Skips invalid lines gracefully

---

## 📜 License

MIT
