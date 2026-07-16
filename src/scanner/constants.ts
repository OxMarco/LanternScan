// How long a scan runs before it stops itself. Both radios are expensive to
// keep open — a BLE scan and a subnet sweep each drain battery and saturate the
// radio — and discovery is front-loaded: nearly everything reachable shows up in
// the first few seconds. The user can always tap Scan again.
export const SCAN_DURATION_MS = 10_000;
