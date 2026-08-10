export type ColorIntensity = "standard" | "vivid";

export type ReadableActivityColor = {
  color: string;
  textColor: "#ffffff" | "#0f172a";
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

export function displayActivityColor(color: string, intensity: ColorIntensity) {
  if (intensity !== "vivid") return color;
  const hsl = /^hsl\(\s*([\d.]+)[, ]+([\d.]+)%[, ]+([\d.]+)%\s*\)$/i.exec(
    color,
  );
  if (hsl) {
    return `hsl(${Number(hsl[1])}, ${clamp(Number(hsl[2]) * 1.22, 45, 88)}%, ${clamp(Number(hsl[3]), 38, 55)}%)`;
  }
  const hex = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(color);
  if (!hex) return color;
  const values = hex.slice(1).map((value) => Number.parseInt(value, 16));
  const average = values.reduce((sum, value) => sum + value, 0) / 3;
  const vivid = values.map((value) =>
    clamp(Math.round(average + (value - average) * 1.28), 24, 224),
  );
  return `#${vivid.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

const hashHue = (seed: string) =>
  [...seed].reduce(
    (hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0,
    2166136261,
  ) % 360;

const rgbToHsl = (red: number, green: number, blue: number) => {
  const r = clamp(red, 0, 255) / 255;
  const g = clamp(green, 0, 255) / 255;
  const b = clamp(blue, 0, 255) / 255;
  const maximum = Math.max(r, g, b);
  const minimum = Math.min(r, g, b);
  const lightness = (maximum + minimum) / 2;
  if (maximum === minimum)
    return { hue: 0, saturation: 0, lightness: lightness * 100 };
  const delta = maximum - minimum;
  const saturation =
    lightness > 0.5
      ? delta / (2 - maximum - minimum)
      : delta / (maximum + minimum);
  let hue =
    maximum === r
      ? (g - b) / delta + (g < b ? 6 : 0)
      : maximum === g
        ? (b - r) / delta + 2
        : (r - g) / delta + 4;
  hue *= 60;
  return { hue, saturation: saturation * 100, lightness: lightness * 100 };
};

const parseDisplayHsl = (value: string) => {
  const hsl = /^hsl\(\s*([\d.]+)[, ]+([\d.]+)%[, ]+([\d.]+)%\s*\)$/i.exec(
    value,
  );
  if (hsl)
    return {
      hue: Number(hsl[1]) % 360,
      saturation: Number(hsl[2]),
      lightness: Number(hsl[3]),
    };
  const shortHex = /^#([\da-f])([\da-f])([\da-f])$/i.exec(value);
  const hex =
    shortHex &&
    `#${shortHex[1]}${shortHex[1]}${shortHex[2]}${shortHex[2]}${shortHex[3]}${shortHex[3]}`;
  const fullHex = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex || value);
  if (fullHex)
    return rgbToHsl(
      Number.parseInt(fullHex[1], 16),
      Number.parseInt(fullHex[2], 16),
      Number.parseInt(fullHex[3], 16),
    );
  const rgb =
    /^rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:[, /]+[\d.]+)?\s*\)$/i.exec(
      value,
    );
  return rgb ? rgbToHsl(Number(rgb[1]), Number(rgb[2]), Number(rgb[3])) : null;
};

const hslToRgb = (hue: number, saturation: number, lightness: number) => {
  const s = saturation / 100;
  const l = lightness / 100;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const section = (((hue % 360) + 360) % 360) / 60;
  const intermediate = chroma * (1 - Math.abs((section % 2) - 1));
  const [red, green, blue] =
    section < 1
      ? [chroma, intermediate, 0]
      : section < 2
        ? [intermediate, chroma, 0]
        : section < 3
          ? [0, chroma, intermediate]
          : section < 4
            ? [0, intermediate, chroma]
            : section < 5
              ? [intermediate, 0, chroma]
              : [chroma, 0, intermediate];
  const match = l - chroma / 2;
  return [red + match, green + match, blue + match];
};

const relativeLuminance = (channels: number[]) =>
  channels
    .map((channel) =>
      channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    )
    .reduce(
      (sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index],
      0,
    );

export function readableActivityColor(
  color: string | undefined,
  seed: string,
  intensity: ColorIntensity = "standard",
): ReadableActivityColor {
  const parsed = parseDisplayHsl(String(color || "").trim());
  const tooPale = !parsed || parsed.lightness > 82;
  const hue = tooPale ? hashHue(seed) : parsed.hue;
  const saturation = clamp(
    tooPale ? 68 : Math.max(parsed.saturation, 42),
    42,
    intensity === "vivid" ? 88 : 78,
  );
  const lightness = clamp(tooPale ? 48 : parsed.lightness, 34, 62);
  const normalized = `hsl(${Math.round(hue)}, ${Math.round(saturation)}%, ${Math.round(lightness)}%)`;
  const luminance = relativeLuminance(hslToRgb(hue, saturation, lightness));
  const whiteContrast = 1.05 / (luminance + 0.05);
  const darkContrast = (luminance + 0.05) / 0.059;
  return {
    color: normalized,
    textColor: darkContrast >= whiteContrast ? "#0f172a" : "#ffffff",
  };
}
