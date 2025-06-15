// vite-plugin-redirects-update.js
import fs from 'fs';
import path from 'path';
import { loadEnv } from 'vite';
import { logBox, logStep } from './utils.js';

const rootDir = process.cwd();
const env = loadEnv('', rootDir, '');

// ─────────────── helpers ───────────────
const getLines = tpl =>
  tpl
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'));

const extractVars = str => [...new Set(str.match(/{{(.*?)}}/g)?.map(m => m.slice(2, -2)) || [])];

const hasAllEnvVars = (str, envMap) => extractVars(str).every(k => envMap[k]);

const applyEnv = (str, envMap) => str.replace(/{{(.*?)}}/g, (_, k) => envMap[k]);

const splitTargetPath = url => {
  const target = url.match(/^https?:\/\/[^/]+/)?.[0] || '';
  const pathPart = (url.slice(target.length).replace(/:\w+$/, '') || '/').replace(/\/+$/, '/');
  return { target, pathPart };
};

const makeProxyEntry = (prefix, { target, pathPart }) => {
  const entry = { target, changeOrigin: true, secure: false };
  if (pathPart !== '/' && !pathPart.startsWith(prefix)) {
    const pat = new RegExp(`^${prefix}`);
    entry.rewrite = p => p.replace(pat, pathPart);
  }
  return entry;
};

// ─────────────── core logic ───────────────
const buildProxyMap = (template, envMap, log = false) => {
  const proxy = {};
  for (const line of getLines(template)) {
    if (!hasAllEnvVars(line, envMap)) continue;
    const [from, raw] = line.split(/\s+/);
    if (!from || !raw) continue;
    const route = from.replace(/\*$/, '');
    if (route === '/') continue;
    const resolved = applyEnv(raw, envMap);
    const { target, pathPart } = splitTargetPath(resolved);
    proxy[route] = makeProxyEntry(route, { target, pathPart });
    if (log) logStep('rewrite', route, '→', `${target}${pathPart}`);
  }
  return proxy;
};

// ─────────────── plugin ───────────────
export default function redirectsUpdate({ templateFile = 'redirects.template' } = {}) {
  const templatePath = path.resolve(rootDir, templateFile);
  if (!fs.existsSync(templatePath)) {
    return logBox(`${templateFile} not found at project root`, 'warn');
  }

  const template = fs.readFileSync(templatePath, 'utf8');
  const allVars = [...new Set(getLines(template).flatMap(extractVars))];
  const envMap = Object.fromEntries(allVars.map(k => [k, env[k] || process.env[k]]).filter(([, v]) => !!v));

  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    return {
      name: 'vite-redirects-update:dev',
      apply: 'serve',
      config(c) {
        const proxy = buildProxyMap(template, envMap, true);
        c.server = c.server || {};
        c.server.proxy = { ...(c.server.proxy || {}), ...proxy };
        logBox('Development redirects loaded');
      },
    };
  }

  return {
    name: 'vite-redirects-update:prod',
    apply: 'build',
    buildStart() {
      try {
        const finalLines = getLines(template).filter(line => hasAllEnvVars(line, envMap));
        const result = finalLines.map(l => applyEnv(l, envMap)).join('\n');
        const outputPath = path.resolve(rootDir, 'public/_redirects');
        fs.writeFileSync(outputPath, result);
        buildProxyMap(finalLines.join('\n'), envMap, true); // log rewrites
        logBox('Production redirects loaded');
      } catch (e) {
        logBox(`Failed writing _redirects: ${e.message}`, 'error');
        process.exit(1);
      }
    },
  };
}
