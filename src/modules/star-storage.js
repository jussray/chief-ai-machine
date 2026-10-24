const STAR_STORAGE_KEY = 'chief-stars';
const MAX_STARS = 500;

function isStarReference(value) {
  return (typeof value === 'number' && Number.isSafeInteger(value))
    || (typeof value === 'string' && value.length > 0 && value.length <= 180);
}

export function readStarStorage() {
  let raw;
  try {
    raw = localStorage.getItem(STAR_STORAGE_KEY);
  } catch {
    return { state: 'unavailable', stars: [] };
  }
  if (raw === null) return { state: 'ready', stars: [] };

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return { state: 'corrupt', stars: [] };
    if (parsed.length > MAX_STARS) return { state: 'corrupt', stars: [] };
    if (parsed.some((value) => !isStarReference(value))) return { state: 'corrupt', stars: [] };
    if (new Set(parsed).size !== parsed.length) return { state: 'corrupt', stars: [] };
    return { state: 'ready', stars: parsed };
  } catch {
    return { state: 'corrupt', stars: [] };
  }
}

export function writeStarStorage(stars) {
  localStorage.setItem(STAR_STORAGE_KEY, JSON.stringify(stars));
}
