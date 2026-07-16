const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

// Hermes has no atob; decode base64 by hand. Returns undefined on any
// malformed input rather than throwing — advertisement payloads come straight
// off the radio and are not worth crashing over.
export function decodeBase64(data: string | null | undefined): Uint8Array | undefined {
  if (!data) return undefined;
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of data) {
    if (char === '=') break;
    if (char === '\n' || char === '\r') continue;
    const value = BASE64_ALPHABET.indexOf(char);
    if (value === -1) return undefined;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return Uint8Array.from(bytes);
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
