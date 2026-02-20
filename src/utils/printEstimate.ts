import type { PrintSettings } from '../types/index';

export const MATERIALS: Record<string, { label: string; density: number }> = {
  PLA:   { label: 'PLA',   density: 1.24 },
  ABS:   { label: 'ABS',   density: 1.04 },
  PETG:  { label: 'PETG',  density: 1.27 },
  TPU:   { label: 'TPU',   density: 1.21 },
  Nylon: { label: 'Nylon', density: 1.14 },
  Resin: { label: 'Resin', density: 1.15 },
};

const SETTINGS_KEY = 'stl-library-print-settings';

const DEFAULTS: PrintSettings = { material: 'PLA', infillPercent: 20 };

export function getPrintSettings(): PrintSettings {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) return { ...DEFAULTS, ...(JSON.parse(saved) as Partial<PrintSettings>) };
  } catch (e) { console.warn('[printEstimate] Failed to parse saved settings, using defaults:', e); }
  return { ...DEFAULTS };
}

export function savePrintSettings(settings: PrintSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

/**
 * Estimate filament weight in grams.
 * volumeMm3: volume in mm³ (from geometry analysis, which uses model units — typically mm)
 * Returns null if volume is null (mesh not watertight).
 */
export function estimateWeight(volumeMm3: number | null | undefined, settings?: PrintSettings): number | null {
  if (volumeMm3 == null) return null;
  const { material, infillPercent } = settings ?? getPrintSettings();
  const density = MATERIALS[material]?.density ?? 1.24;
  const volumeCm3 = volumeMm3 / 1000; // mm³ → cm³
  // Simplified: assume the model is infillPercent% filled
  const infillFactor = infillPercent / 100;
  return +(volumeCm3 * infillFactor * density).toFixed(1);
}
