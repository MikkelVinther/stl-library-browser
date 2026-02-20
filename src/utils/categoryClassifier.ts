/**
 * Auto-classification engine for STL files.
 * Classifies files into structured categories based on folder structure,
 * filename keywords, and geometry analysis.
 */

import type { CategoryValues } from '../types/index';

// ── Keyword dictionaries ──

const ROLE_KEYWORDS: Record<string, string[]> = {
  scatter: ['scatter', 'debris', 'rock', 'barrel', 'crate', 'bush', 'tree', 'stump', 'mushroom', 'crystal', 'candle', 'torch'],
  tile: ['tile', 'floor', 'wall', 'corner', 'straight', 'corridor', 'doorway', 'entrance', 'passage'],
  terrain: ['terrain', 'cliff', 'hill', 'mountain', 'bridge', 'ruin', 'building', 'tower', 'castle', 'house', 'tavern'],
  prop: ['prop', 'chest', 'table', 'chair', 'statue', 'fountain', 'altar', 'throne', 'bed', 'bookshelf', 'cart', 'wagon'],
  monster: ['monster', 'creature', 'beast', 'dragon', 'demon', 'boss', 'enemy'],
  miniature: ['mini', 'miniature', 'character', 'hero', 'npc', 'figure', 'villager', 'guard'],
  base: ['base', 'pedestal', 'platform', 'stand'],
};

const FILL_KEYWORDS: Record<string, string[]> = {
  hollow: ['hollow', 'hollowed'],
  solid: ['solid', 'filled', 'full'],
};

const CREATURE_KEYWORDS: Record<string, string[]> = {
  demon: ['demon', 'devil', 'fiend', 'imp'],
  dragon: ['dragon', 'drake', 'wyvern', 'wyrm'],
  undead: ['undead', 'zombie', 'skeleton', 'lich', 'vampire', 'ghost', 'wraith'],
  beast: ['beast', 'wolf', 'bear', 'spider', 'rat', 'boar', 'serpent', 'snake'],
  elemental: ['elemental', 'golem', 'construct'],
  goblinoid: ['goblin', 'hobgoblin', 'bugbear', 'kobold'],
};

const RACE_KEYWORDS: Record<string, string[]> = {
  human: ['human', 'man', 'woman', 'peasant', 'knight', 'soldier'],
  elf: ['elf', 'elven', 'elfish'],
  dwarf: ['dwarf', 'dwarven'],
  orc: ['orc', 'orcish', 'half-orc'],
  halfling: ['halfling', 'hobbit'],
  tiefling: ['tiefling'],
};

const CLASS_KEYWORDS: Record<string, string[]> = {
  fighter: ['fighter', 'warrior', 'barbarian', 'paladin', 'knight', 'soldier'],
  wizard: ['wizard', 'mage', 'sorcerer', 'warlock', 'witch'],
  rogue: ['rogue', 'thief', 'assassin', 'ranger'],
  cleric: ['cleric', 'priest', 'monk', 'healer'],
  bard: ['bard', 'minstrel'],
  druid: ['druid', 'shaman'],
};

// ── Size patterns matched against raw filename, not just tokens ──

const SIZE_PATTERNS: Array<{ pattern: RegExp; value: string }> = [
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
function matchDictionary(tokens: string[], dictionary: Record<string, string[]>): string | null {
  let bestValue: string | null = null;
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
function inferScale(dimensions?: { x: number; y: number; z: number }): string | null {
  if (!dimensions) return null;
  const height = dimensions.z; // Z is typically "up" in STL files
  if (height <= 0) return null;

  // Only attempt scale inference for miniature-sized objects
  if (height > 100) return null;

  if (height >= 20 && height <= 27) return '25mm';
  if (height >= 28 && height <= 38) return '32mm';
  if (height >= 45 && height <= 60) return '50mm';
  if (height >= 65 && height <= 85) return '75mm';

  return null;
}

/**
 * Extract size from filename using regex patterns.
 */
function extractSize(filename: string): string | null {
  for (const { pattern, value } of SIZE_PATTERNS) {
    if (pattern.test(filename)) return value;
  }
  return null;
}

// ── Main classifier ──

interface ClassifyParams {
  relativePath: string;
  filename: string;
  tokens: string[];
  geometry?: { dimensions?: { x: number; y: number; z: number } };
}

/**
 * Classify a file into structured categories.
 * Returns a CategoryValues object with only non-null keys set.
 */
export function classifyFile({ relativePath, filename, tokens, geometry }: ClassifyParams): CategoryValues {
  const categories: CategoryValues = {};

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
  const role = matchDictionary(tokens, ROLE_KEYWORDS);
  const fill = matchDictionary(tokens, FILL_KEYWORDS);
  const creature = matchDictionary(tokens, CREATURE_KEYWORDS);
  const race = matchDictionary(tokens, RACE_KEYWORDS);
  const cls = matchDictionary(tokens, CLASS_KEYWORDS);

  if (role) categories.role = role;
  if (fill) categories.fill = fill;
  if (creature) categories.creature = creature;
  if (race) categories.race = race;
  if (cls) categories.class = cls;

  // 3. Size: filename patterns first, then geometry fallback
  const size = extractSize(filename) ?? inferScale(geometry?.dimensions);
  if (size) categories.size = size;

  return categories;
}

/** All category IDs in display order */
export const CATEGORY_IDS: string[] = ['creator', 'collection', 'role', 'size', 'fill', 'creature', 'race', 'class'];

/** Human-readable labels */
export const CATEGORY_LABELS: Record<string, string> = {
  creator: 'Creator',
  collection: 'Collection',
  role: 'Role',
  size: 'Size',
  fill: 'Fill',
  creature: 'Creature',
  race: 'Race',
  class: 'Class',
};
