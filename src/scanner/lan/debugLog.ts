// Dev-only diagnostic logging for LAN discovery. Each source narrates what it
// finds (and useLanScanner narrates which paths it takes), so an empty device
// list can be traced to the specific dead source — mDNS blocked by the Local
// Network permission, SSDP failing without the multicast entitlement, or the
// TCP sweep never running because NetInfo returned no subnet. Production builds
// short-circuit to a no-op so scanning stays silent and side-effect-free.
export function lanLog(message: string): void {
  if (!__DEV__) return;
  console.log(`[lan] ${message}`);
}
