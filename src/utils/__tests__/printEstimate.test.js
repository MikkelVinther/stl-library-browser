import { estimateWeight, MATERIALS, getPrintSettings, savePrintSettings } from '../printEstimate.js';

describe('estimateWeight', () => {
  it('returns null when volume is null', () => {
    expect(estimateWeight(null, { material: 'PLA', infillPercent: 20 })).toBeNull();
  });

  it('returns null when volume is undefined', () => {
    expect(estimateWeight(undefined, { material: 'PLA', infillPercent: 20 })).toBeNull();
  });

  it('computes PLA weight at 100% infill', () => {
    // 1000 mm³ = 1 cm³, PLA density=1.24, infill=100%
    // weight = 1 * 1.0 * 1.24 = 1.2g (rounded to 1 decimal)
    expect(estimateWeight(1000, { material: 'PLA', infillPercent: 100 })).toBe(1.2);
  });

  it('computes PLA weight at 20% infill', () => {
    // 1000 mm³ = 1 cm³, PLA density=1.24, infill=20%
    // weight = 1 * 0.20 * 1.24 = 0.248 → 0.2g
    expect(estimateWeight(1000, { material: 'PLA', infillPercent: 20 })).toBe(0.2);
  });

  it('computes PETG weight at 50% infill', () => {
    // 2000 mm³ = 2 cm³, PETG density=1.27, infill=50%
    // weight = 2 * 0.5 * 1.27 = 1.27g → 1.3g
    expect(estimateWeight(2000, { material: 'PETG', infillPercent: 50 })).toBe(1.3);
  });

  it('falls back to PLA density for unknown material', () => {
    // Unknown material → density 1.24 (PLA)
    // 1000mm³, 100% infill: 1 * 1.0 * 1.24 = 1.2g
    expect(estimateWeight(1000, { material: 'UNKNOWN', infillPercent: 100 })).toBe(1.2);
  });

  it('returns 0 when infill is 0%', () => {
    expect(estimateWeight(5000, { material: 'PLA', infillPercent: 0 })).toBe(0);
  });

  it('returns a number rounded to 1 decimal', () => {
    const result = estimateWeight(1234, { material: 'ABS', infillPercent: 33 });
    expect(typeof result).toBe('number');
    expect(result.toString()).toMatch(/^\d+(\.\d)?$/);
  });
});

describe('MATERIALS', () => {
  it('includes PLA, ABS, PETG, TPU, Nylon, Resin', () => {
    expect(Object.keys(MATERIALS)).toEqual(
      expect.arrayContaining(['PLA', 'ABS', 'PETG', 'TPU', 'Nylon', 'Resin'])
    );
  });

  it('each material has a positive density', () => {
    for (const mat of Object.values(MATERIALS)) {
      expect(mat.density).toBeGreaterThan(0);
    }
  });
});

describe('getPrintSettings / savePrintSettings', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns defaults when nothing saved', () => {
    const settings = getPrintSettings();
    expect(settings.material).toBe('PLA');
    expect(settings.infillPercent).toBe(20);
  });

  it('returns saved settings after savePrintSettings', () => {
    savePrintSettings({ material: 'PETG', infillPercent: 40 });
    const settings = getPrintSettings();
    expect(settings.material).toBe('PETG');
    expect(settings.infillPercent).toBe(40);
  });

  it('merges partial saved settings with defaults', () => {
    localStorage.setItem('stl-library-print-settings', JSON.stringify({ material: 'ABS' }));
    const settings = getPrintSettings();
    expect(settings.material).toBe('ABS');
    expect(settings.infillPercent).toBe(20); // default preserved
  });

  it('returns defaults when localStorage has invalid JSON', () => {
    localStorage.setItem('stl-library-print-settings', 'not-json{');
    const settings = getPrintSettings();
    expect(settings.material).toBe('PLA');
    expect(settings.infillPercent).toBe(20);
  });
});
