# 🔁 vite-proxy-redirects-plugin

A custom [Vite](https://vitejs.dev) plugin that enables dynamic redirect/proxy configuration for development and static `_redirects` file generation for production (e.g. Netlify). It reads from a simple `redirects.template` file and supports environment-based dynamic routing.

---

## 📦 Installation

```bash
npm install vite-proxy-redirects-plugin --save-dev
```

---

## ⚙️ Usage

### 1. **Add the plugin to your Vite config:**

```js
// vite.config.js
import redirectsUpdate from 'vite-proxy-redirects-plugin';

export default {
  plugins: [
    redirectsUpdate({
      proxyEnv: 'BASE_PROXY_URL',        // optional: defaults to 'BASE_PROXY_URL'
      templateFile: 'redirects.template' // optional: defaults to 'redirects.template'
    })
  ]
};
```

---

### 2. **Define environment variables:**

Add your proxy base URL in `.env`:

```env
BASE_PROXY_URL=https://api.example.com
```

---

### 3. **Create `redirects.template` file at the project root:**

```txt
# Format: [source_path] [target_url]
/api/* {{BASE_PROXY_URL}}/api/
/auth/* https://auth.example.com/auth/
```

* You may use `{{ENV_VAR_NAME}}` placeholders to dynamically reference environment values.

---

## 🛠 How It Works

### 🧪 Development (`vite serve`)

* Parses the `redirects.template` file.
* Sets up Vite's dev server proxy based on route rules.
* Applies automatic path rewrites (if needed).
* Logs applied rewrites via `logStep()`.

### 📦 Production (`vite build`)

* Replaces `{{ENV_VAR}}` placeholders with values from `.env`.
* Writes the final output to `public/_redirects` for use with static hosts like **Netlify**.

---

## 📁 Output Example

Given:

```txt
/api/* {{BASE_PROXY_URL}}/v1/
/auth/* https://auth.example.com/login/
```

And `.env`:

```env
BASE_PROXY_URL=https://api.example.com
```

Then `public/_redirects` will contain:

```txt
/api/* https://api.example.com/v1/
/auth/* https://auth.example.com/login/
```

---

## 🧩 Template Syntax Notes

* Supports comments with `#`.
* Routes ending with `*` are interpreted as wildcard paths.
* `{{ENV_VAR}}` is replaced only during **build**, not during dev.
* If rewrite path doesn't match the original prefix, a rewrite function is applied.

---

## 📜 License

MIT
