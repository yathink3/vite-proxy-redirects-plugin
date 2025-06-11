import fs from 'fs';
import path from 'path';
import { logBox, logStep } from './utils.js';
import { loadEnv } from 'vite';
const rootDir = process.cwd();
const env = loadEnv('', rootDir, '');

// ───────────── Proxy Logic ─────────────
function parseRedirects({ template, proxyEnv }) {
  const lines = template
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'));
  const proxy = {};
  for (const line of lines) {
    const [from, to] = line.split(/\s+/);
    if (!from || !to) continue;
    const routePrefix = from.replace(/\*$/, '');
    if (routePrefix === '/') continue;
    const isEnvBased = to.includes(`{{${proxyEnv}}}`);
    const target = isEnvBased ? env[proxyEnv] : to.match(/^https?:\/\/[^/]+/)?.[0] || '';
    const toPath = isEnvBased
      ? to
          .replace(`{{${proxyEnv}}}`, '')
          .replace(/^https?:\/\/[^/]+/, '')
          .replace(/:\w+$/, '')
      : to.replace(/^https?:\/\/[^/]+/, '').replace(/:\w+$/, '');
    proxy[routePrefix] = { target, changeOrigin: true, secure: false };
    if (toPath && toPath !== '/' && toPath !== routePrefix && !toPath.startsWith(routePrefix)) {
      const pattern = new RegExp(`^${routePrefix}`);
      proxy[routePrefix].rewrite = path => path.replace(pattern, toPath);
      logStep(`rewrite`,`${routePrefix}`, `→`, `${target}${toPath || '/'}`);
    } else {
      logStep(`rewrite`,`${routePrefix}`, `→`, `${target}${toPath || '/'}`);
    }
  }
  return proxy;
}

// ───────────── Plugin Entry ─────────────
/**
 * @property {string} [proxyEnv] - The name of the environment variable that provides the proxy URL. Defaults to `'BASE_PROXY_URL'`.
 * @property {string} [templateFile] - The name of the redirects template file located in the project root. Defaults to `'redirects.template'`.
 * @returns {import('vite').Plugin} - A Vite plugin instance that updates redirects based on the template.
 */
export default function redirectsUpdate({ proxyEnv = 'BASE_PROXY_URL', templateFile = 'redirects.template' } = {}) {
  if (!env[proxyEnv]) return logBox(`${proxyEnv} not defined in .env`, 'warn');
  const templatePath = path.resolve(rootDir, templateFile);
  if (!fs.existsSync(templatePath)) return logBox(`${templateFile} not found at root of directory`, 'warn');

  const isProduction = process.env.NODE_ENV === 'production';
  const template = fs.readFileSync(templatePath, 'utf8');

  if (!isProduction) {
    return {
      name: 'update-redirects-dev-proxy',
      apply: 'serve',
      config(config) {
        const proxy = parseRedirects({ template, proxyEnv });
        config.server = config.server || {};
        config.server.proxy = { ...(config.server.proxy || {}), ...proxy };
        logBox('Loaded development redirects');
      },
    };
  }

  return {
    name: 'update-redirects-prod',
    apply: 'build',
    buildStart() {
      try {
        const outputPath = path.resolve(rootDir, 'public/_redirects');
        const result = template.replace(new RegExp(`{{${proxyEnv}}}`, 'g'), env[proxyEnv]);
        fs.writeFileSync(outputPath, result);
        logBox(`_redirects file written with ${env[proxyEnv]}`);
      } catch (err) {
        logBox(`Failed to write _redirects: ${err.message}`, 'error');
        process.exit(1);
      }
    },
  };
}
