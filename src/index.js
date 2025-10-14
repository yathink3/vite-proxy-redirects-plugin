import fs from 'fs';
import path from 'path';
import { loadEnv } from 'vite';

const rootDir = process.cwd();
const env = loadEnv('', rootDir, '');

// ─────────────── helpers ───────────────

const colors = {
  green: s => `\x1b[32m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  red: s => `\x1b[31m${s}\x1b[0m`,
  cyan: s => `\x1b[36m${s}\x1b[0m`,
  gray: s => `\x1b[90m${s}\x1b[0m`,
  blue: s => `\x1b[34m${s}\x1b[0m`,
  magenta: s => `\x1b[35m${s}\x1b[0m`,
  white: s => `\x1b[37m${s}\x1b[0m`,
};

function logBox(msg, type = 'info') {
  const color = { info: colors.green, warn: colors.yellow, error: colors.red }[type];
  const symbol = { info: 'ℹ', warn: '⚠', error: '✖' }[type];
  console.log(color(`${symbol}  ${msg}`));
}

function logStep(...parts) {
  const palette = [colors.gray, colors.white, colors.blue, colors.green, colors.magenta, colors.yellow, colors.cyan];
  const colored = parts.map((part, i) => {
    const color = palette[i % palette.length];
    return color(part);
  });
  console.log(`  ${colors.cyan('↪')} ${colored.join(' ')}`);
}

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
  const urlpart = url.slice(target.length)
  const pathPart = (urlpart.replace(/\*/g, '').replace(/:\w+$/, '') || '/').replace(/\/+$/, '/');
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

const detectPlatform = () => {
  const flag = v => String(v || '').toLowerCase();
  const platform = flag(env.DEPLOY_PLATFORM);
  if (platform === 'vercel') return 'vercel';
  if (platform === 'netlify') return 'netlify';
  if (platform === 'nginx') return 'nginx';
  if (env.VERCEL === '1') return 'vercel';
  if (env.NETLIFY === 'true') return 'netlify';
  return '';
};

// ─────────────── redirect writers ───────────────
const writeNetlifyRedirects = (lines, envMap, outputPath) => {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const redirects = lines.map(line => {
    const [from, to] = line.split(/\s+/);
    const resolvedTo = applyEnv(to, envMap).replace(/\*/g, ':splat');
    if(from === '/*' && resolvedTo === '/index.html') return '';
    return `${from} ${resolvedTo} 200!`;
  }).filter(Boolean);
  redirects.push('/* /index.html 200');
  const result = redirects.join('\n');
  fs.writeFileSync(outputPath, result);
};

const writeVercelRedirects = (lines, envMap, outputPath) => {
  const rewrites = lines.map(line => {
    const [from, to] = line.split(/\s+/);
    // const resolvedTo = applyEnv(to, envMap).replace(/\*/g, ':splat');
    const resolvedTo = applyEnv(to, envMap).replace(/\*/g, '').replace(/:\w+$/, '');
    if(from === '/*' && resolvedTo === '/index.html') return '';
    return { source: from, destination: resolvedTo };
  }).filter(Boolean);
  rewrites.push({ source: "/(.*)", destination: "/" });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const json = { rewrites };
  fs.writeFileSync(outputPath, JSON.stringify(json, null, 2));
};

const writeNginxRedirects = (lines, envMap, outputPath) => {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const header = `# Nginx Redirects
#
# Copy and paste the following rewrite rules into your Nginx server block.
#
# Example server block:
# server {
#   listen 80;
#   server_name example.com;
#   root /var/www/html;
#
#   // Paste the content below here
#
#   location / {
#     try_files $uri $uri/ =404;
#   }
# }
\n`;

  const rewriteRules = lines.map(line => {
    const [from, to] = line.split(/\s+/);
    const escapedFrom = from.replace(/([.])/g, '\\$1').replace(/\*$/, '(.*)');
    const resolvedTo = applyEnv(to, envMap);
    const resolvedToWithCapture = resolvedTo.endsWith('$1') ? resolvedTo : `${resolvedTo}$1`;
    return `rewrite ^${escapedFrom}$ ${resolvedToWithCapture} permanent;`;
  });
  fs.writeFileSync(outputPath, header + rewriteRules.join('\n'));
};

// ─────────────── proxy builder ───────────────
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
/**
 * Creates a Vite plugin that configures development proxy rewrites
 * and generates production redirect configuration for Netlify, Vercel, or Nginx.
 *
 * @param {Object} [options] - Plugin options.
 * @param {string} [options.templateFile='redirects.template'] - Redirects template file in the project root.
 * @param {string} [options.deployPlatform='netlify'] - Optional override for deployment platform ('netlify', 'vercel' or 'nginx').
 * @returns {import('vite').Plugin} - A Vite plugin instance that handles dynamic redirects.
 */
export default function redirectsUpdate({ templateFile = 'redirects.template', deployPlatform = 'netlify' } = {}) {
  const templatePath = path.resolve(rootDir, templateFile);
  if (!fs.existsSync(templatePath)) {
    logBox(`${templateFile} not found at project root`, 'warn');
    return;
  }

  const template = fs.readFileSync(templatePath, 'utf8');
  const allVars = [...new Set(getLines(template).flatMap(extractVars))];
  const envMap = Object.fromEntries(allVars.map(k => [k, env[k]]).filter(([, v]) => !!v));
  let outDir = 'dist';
  const isProd = process.env.NODE_ENV === 'production';

  return {
    name: 'vite-redirects-update',
    enforce: 'post',
    apply: () => true,
    config(c, { command }) {
      if (command === 'serve') {
        const proxy = buildProxyMap(template, envMap, true);
        c.server = c.server || {};
        c.server.proxy = { ...(c.server.proxy || {}), ...proxy };
        logBox('Development redirects loaded');
      }
    },
    configResolved(config) {
      outDir = config.build.outDir || 'dist';
    },
    generateBundle() {
      if (isProd) {
        try {
          const lines = getLines(template).filter(line => hasAllEnvVars(line, envMap));
          const platform = detectPlatform() || deployPlatform || 'unknown';

          if (platform === 'netlify') {
            const outputPath = path.resolve(outDir, '_redirects');
            writeNetlifyRedirects(lines, envMap, outputPath);
            logBox(`Wrote Netlify _redirects to ${outputPath}`);
          } else if (platform === 'vercel') {
            const vercelPath = path.resolve(outDir, 'vercel.json');
            writeVercelRedirects(lines, envMap, vercelPath);
            logBox(`Wrote Vercel redirects to ${vercelPath}`);
          } else if (platform === 'nginx') {
            const nginxPath = path.resolve(outDir, 'nginx.conf.snippet');
            writeNginxRedirects(lines, envMap, nginxPath);
            logBox(`Wrote Nginx config snippet to ${nginxPath}`);
          } else {
            logBox(`Unknown deploy platform. Set DEPLOY_PLATFORM=netlify|vercel|nginx`, 'warn');
          }

          buildProxyMap(lines.join('\n'), envMap, true);
        } catch (e) {
          logBox(`Failed writing redirects: ${e.message}`, 'error');
        }
      }
    },
  };
}
