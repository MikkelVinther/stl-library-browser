import { describe, it, expect } from 'vitest';
import { toArrayBuffer } from '../bufferUtils';

describe('toArrayBuffer', () => {
  it('returns input unchanged when already an ArrayBuffer', () => {
    const ab = new ArrayBuffer(8);
    const result = toArrayBuffer(ab);
    expect(result).toBe(ab);
  });

  it('returns correct slice for a Uint8Array with non-zero byteOffset', () => {
    // Create a backing buffer and take a sub-view starting at offset 4
    const backing = new ArrayBuffer(16);
    const full = new Uint8Array(backing);
    // Write a recognizable pattern into bytes 4-7
    full[4] = 0xDE;
    full[5] = 0xAD;
    full[6] = 0xBE;
    full[7] = 0xEF;

    const view = new Uint8Array(backing, 4, 4); // byteOffset=4, byteLength=4
    expect(view.byteOffset).toBe(4);

    const result = toArrayBuffer(view);
    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(result.byteLength).toBe(4);

    const resultBytes = new Uint8Array(result);
    expect(resultBytes[0]).toBe(0xDE);
    expect(resultBytes[1]).toBe(0xAD);
    expect(resultBytes[2]).toBe(0xBE);
    expect(resultBytes[3]).toBe(0xEF);
  });

  it('returns correct slice for a Node.js-style Buffer (subarray of pooled allocation)', () => {
    // Simulate a pool-backed buffer: large backing buffer, data at an offset
    const pool = new ArrayBuffer(1024);
    const poolBytes = new Uint8Array(pool);
    // Write data at offset 512
    poolBytes[512] = 1;
    poolBytes[513] = 2;
    poolBytes[514] = 3;

    // Simulate a Node.js Buffer as a Uint8Array with byteOffset into the pool
    const nodeLikeBuffer = new Uint8Array(pool, 512, 3);

    const result = toArrayBuffer(nodeLikeBuffer);
    expect(result.byteLength).toBe(3);

    const resultBytes = new Uint8Array(result);
    expect(resultBytes[0]).toBe(1);
    expect(resultBytes[1]).toBe(2);
    expect(resultBytes[2]).toBe(3);

    // Critically: the result must not share backing storage with the pool
    // (i.e. modifying result should not affect the pool and vice versa after slice)
    poolBytes[512] = 99;
    expect(resultBytes[0]).toBe(1); // still 1, not 99 — distinct copy
  });
});
