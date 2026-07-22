export type ColorIntensity = "standard" | "vivid";

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

export function displayActivityColor(color: string, intensity: ColorIntensity) {
  if (intensity !== "vivid") return color;
  const hsl = /^hsl\(\s*([\d.]+)[, ]+([\d.]+)%[, ]+([\d.]+)%\s*\)$/i.exec(color);
  if (hsl) {
    return `hsl(${Number(hsl[1])}, ${clamp(Number(hsl[2]) * 1.22, 45, 88)}%, ${clamp(Number(hsl[3]), 38, 55)}%)`;
  }
  const hex = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(color);
  if (!hex) return color;
  const values = hex.slice(1).map((value) => Number.parseInt(value, 16));
  const average = values.reduce((sum, value) => sum + value, 0) / 3;
  const vivid = values.map((value) => clamp(Math.round(average + (value - average) * 1.28), 24, 224));
  return `#${vivid.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}
