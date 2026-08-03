import { normalizeSearchName } from "./activityCatalog";

export type BulkActivityParseResult = {
  names: string[];
  duplicateCount: number;
};

const splitBulkText = (value: string): string[] => {
  const tokens: string[] = [];
  let token = "";
  let quoted = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === '"') {
      if (quoted && value[index + 1] === '"') {
        token += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (
      !quoted &&
      (character === "," ||
        character === "-" ||
        character === "\n" ||
        character === "\r")
    ) {
      tokens.push(token);
      token = "";
      continue;
    }
    token += character;
  }
  tokens.push(token);
  return tokens;
};

export function parseBulkActivities(
  value: string,
  existingNames: readonly string[] = [],
): BulkActivityParseResult {
  const seen = new Set(existingNames.map(normalizeSearchName).filter(Boolean));
  const names: string[] = [];
  let duplicateCount = 0;
  for (const raw of splitBulkText(value)) {
    const name = raw.trim().replace(/\s+/g, " ");
    if (!name) continue;
    const normalized = normalizeSearchName(name);
    if (seen.has(normalized)) {
      duplicateCount += 1;
      continue;
    }
    seen.add(normalized);
    names.push(name);
  }
  return { names, duplicateCount };
}

export const bulkActivityColor = (name: string, index = 0) => {
  let hash = index * 97;
  for (let offset = 0; offset < name.length; offset += 1) {
    hash = name.charCodeAt(offset) + ((hash << 5) - hash);
  }
  return `hsl(${Math.abs(hash) % 360}, 65%, 50%)`;
};

export const createBulkActivityId = (
  mode: "session" | "daily",
  index: number,
  uuid: string = crypto.randomUUID(),
) => `bulk-${mode}-${index}-${uuid}`;
