const NOISE_WORDS = new Set([
  'stl', 'obj', 'file', 'model', 'final', 'copy', 'new', 'old',
  'fixed', 'repaired', 'export', 'exported', 'print', 'ready',
]);

const VERSION_RE = /^v?\d+$/i;

export function tokenizeFilename(filename: string): string[] {
  // Strip extension
  const base = filename.replace(/\.stl$/i, '');

  // Split on separators: _ - space . ( )
  // Then split camelCase: "ForestTree" -> ["Forest", "Tree"]
  const raw = base
    .split(/[_\-\s.()]+/)
    .flatMap((part) => part.split(/(?<=[a-z])(?=[A-Z])/))
    .map((t) => t.toLowerCase().trim())
    .filter(Boolean);

  // Deduplicate and filter noise
  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const token of raw) {
    if (token.length < 2) continue;
    if (VERSION_RE.test(token)) continue;
    if (NOISE_WORDS.has(token)) continue;
    if (seen.has(token)) continue;
    seen.add(token);
    tokens.push(token);
  }

  return tokens;
}
