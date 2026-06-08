const useColor = process.env["NO_COLOR"] === undefined && process.stdout.isTTY === true;

function paint(code: string, text: string): string {
  return useColor ? `\x1b[${code}m${text}\x1b[0m` : text;
}

export function ok(message: string): void {
  console.log(`${paint("32", "✓")} ${message}`);
}

export function warn(message: string): void {
  console.error(`${paint("33", "⚠")} ${message}`);
}

export function err(message: string): void {
  console.error(`${paint("31", "✗")} ${message}`);
}

export function info(message: string): void {
  console.log(message);
}

export function dim(text: string): string {
  return paint("2", text);
}

export function bold(text: string): string {
  return paint("1", text);
}

export function cyan(text: string): string {
  return paint("36", text);
}
