import { classifyFile, CATEGORY_IDS, CATEGORY_LABELS } from '../categoryClassifier.js';

describe('classifyFile — folder structure', () => {
  it('extracts creator and collection from deep path', () => {
    const result = classifyFile({
      relativePath: 'DeathByTiles/DungeonSet/floor_tile.stl',
      filename: 'floor_tile.stl',
      tokens: ['floor', 'tile'],
    });
    expect(result.creator).toBe('DeathByTiles');
    expect(result.collection).toBe('DungeonSet');
  });

  it('extracts only collection from single-folder path', () => {
    const result = classifyFile({
      relativePath: 'DungeonSet/floor_tile.stl',
      filename: 'floor_tile.stl',
      tokens: ['floor', 'tile'],
    });
    expect(result.creator).toBeUndefined();
    expect(result.collection).toBe('DungeonSet');
  });

  it('sets no creator/collection from flat path', () => {
    const result = classifyFile({
      relativePath: 'floor_tile.stl',
      filename: 'floor_tile.stl',
      tokens: ['floor', 'tile'],
    });
    expect(result.creator).toBeUndefined();
    expect(result.collection).toBeUndefined();
  });
});

describe('classifyFile — role keyword matching', () => {
  it('classifies "scatter" role', () => {
    const result = classifyFile({
      relativePath: 'scatter_rock.stl',
      filename: 'scatter_rock.stl',
      tokens: ['scatter', 'rock'],
    });
    expect(result.role).toBe('scatter');
  });

  it('classifies "tile" role', () => {
    const result = classifyFile({
      relativePath: 'floor_tile.stl',
      filename: 'floor_tile.stl',
      tokens: ['floor', 'tile'],
    });
    expect(result.role).toBe('tile');
  });

  it('classifies "miniature" role from "mini"', () => {
    const result = classifyFile({
      relativePath: 'goblin_mini.stl',
      filename: 'goblin_mini.stl',
      tokens: ['goblin', 'mini'],
    });
    expect(result.role).toBe('miniature');
  });
});

describe('classifyFile — creature keyword matching', () => {
  it('classifies dragon creature', () => {
    const result = classifyFile({
      relativePath: 'dragon.stl',
      filename: 'dragon.stl',
      tokens: ['dragon'],
    });
    expect(result.creature).toBe('dragon');
  });

  it('classifies goblinoid from "goblin"', () => {
    const result = classifyFile({
      relativePath: 'goblin_warrior.stl',
      filename: 'goblin_warrior.stl',
      tokens: ['goblin', 'warrior'],
    });
    expect(result.creature).toBe('goblinoid');
  });

  it('classifies undead from "skeleton"', () => {
    const result = classifyFile({
      relativePath: 'skeleton.stl',
      filename: 'skeleton.stl',
      tokens: ['skeleton'],
    });
    expect(result.creature).toBe('undead');
  });
});

describe('classifyFile — race keyword matching', () => {
  it('classifies elf race', () => {
    const result = classifyFile({
      relativePath: 'elf_archer.stl',
      filename: 'elf_archer.stl',
      tokens: ['elf', 'archer'],
    });
    expect(result.race).toBe('elf');
  });

  it('classifies dwarf race', () => {
    const result = classifyFile({
      relativePath: 'dwarf_warrior.stl',
      filename: 'dwarf_warrior.stl',
      tokens: ['dwarf', 'warrior'],
    });
    expect(result.race).toBe('dwarf');
  });
});

describe('classifyFile — class keyword matching', () => {
  it('classifies wizard class', () => {
    const result = classifyFile({
      relativePath: 'wizard.stl',
      filename: 'wizard.stl',
      tokens: ['wizard'],
    });
    expect(result.class).toBe('wizard');
  });

  it('classifies fighter from "warrior"', () => {
    const result = classifyFile({
      relativePath: 'warrior.stl',
      filename: 'warrior.stl',
      tokens: ['warrior'],
    });
    expect(result.class).toBe('fighter');
  });
});

describe('classifyFile — size extraction', () => {
  it('extracts size from filename pattern "28mm" (hyphen separator)', () => {
    // NOTE: underscore is a \w char, so \b28mm does NOT match "goblin_28mm"
    // A hyphen or space before the number creates the required word boundary
    const result = classifyFile({
      relativePath: 'goblin-28mm.stl',
      filename: 'goblin-28mm.stl',
      tokens: ['goblin'],
    });
    expect(result.size).toBe('28mm');
  });

  it('extracts size from filename pattern "32mm" (hyphen separator)', () => {
    const result = classifyFile({
      relativePath: 'hero-32mm-scale.stl',
      filename: 'hero-32mm-scale.stl',
      tokens: ['hero', 'scale'],
    });
    expect(result.size).toBe('32mm');
  });

  it('infers 25mm from geometry height 25mm', () => {
    const result = classifyFile({
      relativePath: 'goblin.stl',
      filename: 'goblin.stl',
      tokens: ['goblin'],
      geometry: { dimensions: { x: 10, y: 10, z: 25 } },
    });
    expect(result.size).toBe('25mm');
  });

  it('filename size takes priority over geometry inference', () => {
    const result = classifyFile({
      relativePath: 'hero-32mm.stl',
      filename: 'hero-32mm.stl',
      tokens: ['hero'],
      geometry: { dimensions: { x: 10, y: 10, z: 25 } }, // would infer 25mm
    });
    expect(result.size).toBe('32mm');
  });

  it('does not infer size for geometry > 100mm tall', () => {
    const result = classifyFile({
      relativePath: 'terrain.stl',
      filename: 'terrain.stl',
      tokens: ['terrain'],
      geometry: { dimensions: { x: 100, y: 100, z: 150 } },
    });
    expect(result.size).toBeUndefined();
  });
});

describe('classifyFile — null value stripping', () => {
  it('omits unmatched categories instead of setting them to null', () => {
    const result = classifyFile({
      relativePath: 'unknown.stl',
      filename: 'unknown.stl',
      tokens: ['unknown'],
    });
    for (const [, value] of Object.entries(result)) {
      expect(value).not.toBeNull();
    }
  });
});

describe('CATEGORY_IDS and CATEGORY_LABELS', () => {
  it('CATEGORY_IDS contains all expected categories', () => {
    expect(CATEGORY_IDS).toEqual(
      expect.arrayContaining(['creator', 'collection', 'role', 'size', 'fill', 'creature', 'race', 'class'])
    );
  });

  it('each CATEGORY_ID has a label', () => {
    for (const id of CATEGORY_IDS) {
      expect(CATEGORY_LABELS[id]).toBeTruthy();
    }
  });
});
