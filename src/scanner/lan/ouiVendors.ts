import { OUI_VENDORS } from '@/scanner/lan/ouiVendors.generated';

// Resolves the networking vendor that owns a MAC/BSSID from its 24-bit OUI
// prefix. Returns undefined for unknown, locally-administered, or masked
// addresses (iOS returns 02:00:00:00:00:00; Android returns a random BSSID
// without location permission).
export function vendorFromMac(mac: string | null | undefined): string | undefined {
  if (!mac) return undefined;
  const hex = mac.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
  if (hex.length < 6) return undefined;
  // Locally-administered addresses (2nd-least-significant bit of the first octet
  // set) carry no real vendor — skip them.
  const firstOctet = parseInt(hex.slice(0, 2), 16);
  if (Number.isNaN(firstOctet) || (firstOctet & 0x02) !== 0) return undefined;
  return OUI_VENDORS[hex.slice(0, 6)];
}
