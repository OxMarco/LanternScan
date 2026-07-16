import { serviceDataHint } from '@/scanner/fingerprint/serviceDataHints';

const b64 = (bytes: number[]) => Buffer.from(bytes).toString('base64');

describe('serviceDataHint', () => {
  it('labels Eddystone UID/URL/TLM frames as beacons', () => {
    expect(serviceDataHint('feaa', b64([0x00, 0xe0]))?.label).toBe('Eddystone beacon');
    expect(serviceDataHint('feaa', b64([0x10, 0xe0]))?.label).toBe('Eddystone beacon');
    expect(serviceDataHint('feaa', b64([0x20, 0x00]))?.label).toBe('Eddystone beacon');
  });

  it('leaves Find My Device frames on 0xFEAA to the tracker detector', () => {
    expect(serviceDataHint('feaa', b64([0x40, 0x00]))).toBeUndefined();
  });

  it('labels Exposure Notification and BTHome broadcasters', () => {
    expect(serviceDataHint('fd6f', b64([0x01]))?.label).toMatch(/phone/i);
    expect(serviceDataHint('fcd2', b64([0x40]))?.label).toMatch(/BTHome/);
  });

  it('decodes a Matter commissioning beacon with vendor and product IDs', () => {
    // opcode 0x00, discriminator 0xABC (LE), VID 0x1349 (LE), PID 0x0042 (LE), flags
    const hint = serviceDataHint('fff6', b64([0x00, 0xbc, 0x0a, 0x49, 0x13, 0x42, 0x00, 0x00]));
    expect(hint?.label).toBe('Matter smart-home device (pairing mode)');
    expect(hint?.reason).toContain('vendor 0x1349');
    expect(hint?.reason).toContain('product 0x0042');
  });

  it('ignores non-commissioning or truncated Matter payloads', () => {
    expect(
      serviceDataHint('fff6', b64([0x01, 0xbc, 0x0a, 0x49, 0x13, 0x42, 0x00, 0x00]))
    ).toBeUndefined();
    expect(serviceDataHint('fff6', b64([0x00, 0xbc, 0x0a]))).toBeUndefined();
  });

  it('has no hint for unknown service data', () => {
    expect(serviceDataHint('ffff', b64([0x01]))).toBeUndefined();
  });
});
