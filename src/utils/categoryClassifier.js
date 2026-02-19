/**
 * Auto-classification engine for STL files.
 * Classifies files into structured categories based on folder structure,
 * filename keywords, and geometry analysis.
 */

// ── Keyword dictionaries ──

const ROLE_KEYWORDS = {
  scatter: ['scatter', 'debris', 'rock', 'barrel', 'crate', 'bush', 'tree', 'stump', 'mushroom', 'crystal', 'candle', 'torch'],
  tile: ['tile', 'floor', 'wall', 'corner', 'straight', 'corridor', 'doorway', 'entrance', 'passage'],
  terrain: ['terrain', 'cliff', 'hill', 'mountain', 'bridge', 'ruin', 'building', 'tower', 'castle', 'house', 'tavern'],
  prop: ['prop', 'chest', 'table', 'chair', 'statue', 'fountain', 'altar', 'throne', 'bed', 'bookshelf', 'cart', 'wagon'],
  monster: ['monster', 'creature', 'beast', 'dragon', 'demon', 'boss', 'enemy'],
  miniature: ['mini', 'miniature', 'character', 'hero', 'npc', 'figure', 'villager', 'guard'],
  base: ['base', 'pedestal', 'platform', 'stand'],
};

const FILL_KEYWORDS = {
  hollow: ['hollow', 'hollowed'],
  solid: ['solid', 'filled', 'full'],
};

const CREATURE_KEYWORDS = {
  demon: ['demon', 'devil', 'fiend', 'imp'],
  dragon: ['dragon', 'drake', 'wyvern', 'wyrm'],
  undead: ['undead', 'zombie', 'skeleton', 'lich', 'vampire', 'ghost', 'wraith'],
  beast: ['beast', 'wolf', 'bear', 'spider', 'rat', 'boar', 'serpent', 'snake'],
  elemental: ['elemental', 'golem', 'construct'],
  goblinoid: ['goblin', 'hobgoblin', 'bugbear', 'kobold'],
};

const RACE_KEYWORDS = {
  human: ['human', 'man', 'woman', 'peasant', 'knight', 'soldier'],
  elf: ['elf', 'elven', 'elfish'],
  dwarf: ['dwarf', 'dwarven'],
  orc: ['orc', 'orcish', 'half-orc'],
  halfling: ['halfling', 'hobbit'],
  tiefling: ['tiefling'],
};

const CLASS_KEYWORDS = {
  fighter: ['fighter', 'warrior', 'barbarian', 'paladin', 'knight', 'soldier'],
  wizard: ['wizard', 'mage', 'sorcerer', 'warlock', 'witch'],
  rogue: ['rogue', 'thief', 'assassin', 'ranger'],
  cleric: ['cleric', 'priest', 'monk', 'healer'],
  bard: ['bard', 'minstrel'],
  druid: ['druid', 'shaman'],
};

// ── Size patterns matched against raw filename, not just tokens ──

const SIZE_PATTERNS = [
  { pattern: /\b25\s*mm\b/i, value: '25mm' },
  { pattern: /\b28\s*mm\b/i, value: '28mm' },
  { pattern: /\b32\s*mm\b/i, value: '32mm' },
  { pattern: /\b50\s*mm\b/i, value: '50mm' },
  { pattern: /\b54\s*mm\b/i, value: '54mm' },
  { pattern: /\b75\s*mm\b/i, value: '75mm' },
];

// ── Helpers ──

/**
 * Match tokens against a keyword dictionary.
 * Returns the value whose keyword list has the most overlap, or null.
 */
function matchDictionary(tokens, dictionary) {
  let bestValue = null;
  let bestCount = 0;

  for (const [value, keywords] of Object.entries(dictionary)) {
    const count = tokens.filter((t) => keywords.includes(t)).length;
    if (count > bestCount) {
      bestCount = count;
      bestValue = value;
    }
  }

  return bestValue;
}

/**
 * Infer miniature scale from geometry height.
 * Only applies to small objects likely to be miniatures (< 100mm tall).
 */
function inferScale(dimensions) {
  if (!dimensions) return null;
  const height = dimensions.z; // Z is typically "up" in STL files
  if (height <= 0) return null;

  // Only attempt scale inference for miniature-sized objects
  if (height > 100) return null;

  if (height >= 20 && height <= 30) return '25mm';
  if (height >= 28 && height <= 38) return '32mm';
  if (height >= 45 && height <= 60) return '50mm';
  if (height >= 65 && height <= 85) return '75mm';

  return null;
}

/**
 * Extract size from filename using regex patterns.
 */
function extractSize(filename) {
  for (const { pattern, value } of SIZE_PATTERNS) {
    if (pattern.test(filename)) return value;
  }
  return null;
}

// ── Main classifier ──

/**
 * Classify a file into structured categories.
 *
 * @param {Object} params
 * @param {string} params.relativePath - Path relative to import root (e.g. "Creator/Collection/file.stl")
 * @param {string} params.filename - Just the filename (e.g. "goblin_warrior_32mm.stl")
 * @param {string[]} params.tokens - Tokens from filenameTokenizer
 * @param {Object} [params.geometry] - Geometry analysis results (dimensions, etc.)
 * @returns {Object} Category values: { creator, collection, role, size, fill, creature, race, class }
 */
export function classifyFile({ relativePath, filename, tokens, geometry }) {
  const categories = {};

  // 1. Folder structure (highest priority)
  const pathParts = relativePath.split('/').filter(Boolean);
  // Remove the filename from path parts
  const folderParts = pathParts.slice(0, -1);

  if (folderParts.length >= 2) {
    categories.creator = folderParts[0];
    categories.collection = folderParts[1];
  } else if (folderParts.length === 1) {
    categories.collection = folderParts[0];
  }

  // 2. Filename keyword matching
  categories.role = matchDictionary(tokens, ROLE_KEYWORDS);
  categories.fill = matchDictionary(tokens, FILL_KEYWORDS);
  categories.creature = matchDictionary(tokens, CREATURE_KEYWORDS);
  categories.race = matchDictionary(tokens, RACE_KEYWORDS);
  categories.class = matchDictionary(tokens, CLASS_KEYWORDS);

  // 3. Size: filename patterns first, then geometry fallback
  categories.size = extractSize(filename) || inferScale(geometry?.dimensions);

  // Strip null values
  for (const key of Object.keys(categories)) {
    if (categories[key] == null) delete categories[key];
  }

  return categories;
}

/** All category IDs in display order */
export const CATEGORY_IDS = ['creator', 'collection', 'role', 'size', 'fill', 'creature', 'race', 'class'];

/** Human-readable labels */
export const CATEGORY_LABELS = {
  creator: 'Creator',
  collection: 'Collection',
  role: 'Role',
  size: 'Size',
  fill: 'Fill',
  creature: 'Creature',
  race: 'Race',
  class: 'Class',
};
