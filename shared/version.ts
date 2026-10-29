function parts(value: string) {
  return value
    .trim()
    .replace(/^v/i, "")
    .split("-")[0]!
    .split(".")
    .map((item) => Number.parseInt(item, 10) || 0);
}

export function newer(candidate: string, current: string) {
  const a = parts(candidate);
  const b = parts(current);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const diff = (a[index] ?? 0) - (b[index] ?? 0);
    if (diff !== 0) return diff > 0;
  }
  return false;
}
