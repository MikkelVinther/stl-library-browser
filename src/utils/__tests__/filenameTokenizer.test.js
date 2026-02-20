import { tokenizeFilename } from '../filenameTokenizer.js';

describe('tokenizeFilename', () => {
  it('strips .stl extension', () => {
    const tokens = tokenizeFilename('dragon.stl');
    expect(tokens).not.toContain('stl');
    expect(tokens).toContain('dragon');
  });

  it('splits on underscores', () => {
    expect(tokenizeFilename('goblin_warrior.stl')).toEqual(['goblin', 'warrior']);
  });

  it('splits on hyphens', () => {
    expect(tokenizeFilename('forest-tree.stl')).toEqual(['forest', 'tree']);
  });

  it('splits on spaces', () => {
    expect(tokenizeFilename('stone wall.stl')).toEqual(['stone', 'wall']);
  });

  it('splits on dots within name', () => {
    expect(tokenizeFilename('stone.wall.v2.stl')).toEqual(['stone', 'wall']);
  });

  it('splits camelCase', () => {
    const tokens = tokenizeFilename('ForestTree.stl');
    expect(tokens).toContain('forest');
    expect(tokens).toContain('tree');
  });

  it('filters noise words', () => {
    const tokens = tokenizeFilename('dragon_stl_model_final.stl');
    expect(tokens).not.toContain('stl');
    expect(tokens).not.toContain('model');
    expect(tokens).not.toContain('final');
    expect(tokens).toContain('dragon');
  });

  it('filters version numbers (v1, v2)', () => {
    const tokens = tokenizeFilename('goblin_v2.stl');
    expect(tokens).not.toContain('v2');
  });

  it('filters bare numeric versions', () => {
    const tokens = tokenizeFilename('goblin_3.stl');
    expect(tokens).not.toContain('3');
  });

  it('deduplicates tokens', () => {
    const tokens = tokenizeFilename('goblin_goblin.stl');
    expect(tokens.filter((t) => t === 'goblin').length).toBe(1);
  });

  it('filters single-character tokens', () => {
    const tokens = tokenizeFilename('a_dragon.stl');
    expect(tokens).not.toContain('a');
    expect(tokens).toContain('dragon');
  });

  it('returns empty array for just noise', () => {
    expect(tokenizeFilename('stl_model_final.stl')).toEqual([]);
  });

  it('handles empty filename', () => {
    expect(tokenizeFilename('.stl')).toEqual([]);
  });

  it('lowercases all tokens', () => {
    const tokens = tokenizeFilename('DRAGON.stl');
    expect(tokens).toContain('dragon');
    expect(tokens).not.toContain('DRAGON');
  });

  it('handles mixed separators', () => {
    const tokens = tokenizeFilename('goblin-warrior_32mm scale.stl');
    expect(tokens).toContain('goblin');
    expect(tokens).toContain('warrior');
    expect(tokens).toContain('32mm');
    expect(tokens).toContain('scale');
  });
});
