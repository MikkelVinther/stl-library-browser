export function parseSTLHeader(buffer) {
  const bytes = new Uint8Array(buffer, 0, Math.min(80, buffer.byteLength));

  // Decode as ASCII and trim null bytes
  let header = '';
  for (let i = 0; i < bytes.length; i++) {
    const ch = bytes[i];
    if (ch === 0) break;
    if (ch >= 32 && ch < 127) {
      header += String.fromCharCode(ch);
    }
  }
  header = header.trim();

  // Check if ASCII STL — extract the solid name
  if (header.startsWith('solid')) {
    const name = header.slice(5).trim();
    return name.length > 0 ? name : null;
  }

  // Binary header — return if it looks meaningful (not just whitespace or gibberish)
  if (header.length < 3) return null;

  return header;
}
