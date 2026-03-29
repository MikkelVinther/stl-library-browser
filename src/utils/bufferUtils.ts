/**
 * Safely converts a Node.js Buffer (or any ArrayBufferView) to a plain ArrayBuffer.
 *
 * Node.js Buffer instances are Uint8Array subclasses backed by a shared pool
 * allocator. Their `.buffer` property points to the entire pool slab, so a
 * non-zero `byteOffset` means the data does NOT start at index 0. Passing the
 * raw `.buffer` to STLLoader (or any WebGL/WASM consumer that reads from offset
 * 0) silently produces corrupted geometry.
 *
 * This helper always returns an ArrayBuffer whose data starts at index 0.
 */
export function toArrayBuffer(input: ArrayBuffer | ArrayBufferView): ArrayBuffer {
  if (input instanceof ArrayBuffer) return input;
  return input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength) as ArrayBuffer;
}
