import { parseSTLHeader } from '../stlHeaderParser.js';

function makeBuffer(text, totalLength = 80) {
  const buf = new ArrayBuffer(totalLength);
  const view = new Uint8Array(buf);
  for (let i = 0; i < Math.min(text.length, totalLength); i++) {
    view[i] = text.charCodeAt(i);
  }
  return buf;
}

describe('parseSTLHeader', () => {
  it('extracts name from ASCII STL with "solid <name>"', () => {
    expect(parseSTLHeader(makeBuffer('solid my_model'))).toBe('my_model');
  });

  it('returns null for ASCII STL with no name ("solid" only)', () => {
    expect(parseSTLHeader(makeBuffer('solid'))).toBeNull();
  });

  it('returns null for ASCII STL with "solid " and only whitespace', () => {
    expect(parseSTLHeader(makeBuffer('solid   '))).toBeNull();
  });

  it('returns header text for binary STL (non-solid prefix)', () => {
    const result = parseSTLHeader(makeBuffer('Binary STL Header Info'));
    expect(result).toBe('Binary STL Header Info');
  });

  it('returns null for buffer shorter than 3 printable chars after trim', () => {
    const buf = new ArrayBuffer(2);
    new Uint8Array(buf).set([65, 66]); // "AB"
    expect(parseSTLHeader(buf)).toBeNull();
  });

  it('stops reading at null byte', () => {
    const result = parseSTLHeader(makeBuffer('Binary\x00garbage'));
    expect(result).toBe('Binary');
  });

  it('skips non-printable bytes', () => {
    const buf = new ArrayBuffer(80);
    const view = new Uint8Array(buf);
    view[0] = 31;  // non-printable (< 32)
    view[1] = 65;  // 'A'
    view[2] = 66;  // 'B'
    view[3] = 67;  // 'C'
    const result = parseSTLHeader(buf);
    expect(result).toBe('ABC');
  });

  it('handles empty buffer', () => {
    expect(parseSTLHeader(new ArrayBuffer(0))).toBeNull();
  });

  it('handles buffer with only whitespace', () => {
    expect(parseSTLHeader(makeBuffer('   '))).toBeNull();
  });

  it('only reads first 80 bytes', () => {
    const text = 'A'.repeat(100);
    const result = parseSTLHeader(makeBuffer(text, 100));
    // Should still return something (first 80 'A' chars)
    expect(result).not.toBeNull();
    expect(result.length).toBeLessThanOrEqual(80);
  });
});
