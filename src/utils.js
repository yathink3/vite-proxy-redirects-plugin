export const colors = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  gray: (s) => `\x1b[90m${s}\x1b[0m`,
  blue: (s) => `\x1b[34m${s}\x1b[0m`,
  magenta: (s) => `\x1b[35m${s}\x1b[0m`,
  white: (s) => `\x1b[37m${s}\x1b[0m`,
};

export function logBox(msg, type = "info") {
  const color = { info: colors.green, warn: colors.yellow, error: colors.red }[
    type
  ];
  const symbol = { info: "ℹ", warn: "⚠", error: "✖" }[type];
  console.log(color(`${symbol}  ${msg}`));
}

export function logStep(...parts) {
  const palette = [
    colors.gray,
    colors.white,
    colors.blue,
    colors.green,
    colors.magenta,
    colors.yellow,
    colors.cyan,
  ];
  const colored = parts.map((part, i) => {
    const color = palette[i % palette.length];
    return color(part);
  });
  console.log(`  ${colors.cyan("↪")} ${colored.join(" ")}`);
}
