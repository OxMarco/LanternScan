// Lantern is intentionally dark by design. Warm obsidian creates the night;
// one controlled amber light guides attention. Semantic colours only appear
// when they communicate trust, novelty, or risk.
const theme = {
  background: '#090A07',
  surface: '#151710',
  text: '#F6F1E6',
  muted: '#98998F',
  primary: '#FFD45A',
  primaryContrast: '#171409',
  accent: '#FFE8A3',
  accentContrast: '#171409',
  inverse: '#0D0E0A',
  inverseText: '#FAF5E9',
  inverseMuted: '#AAA99E',
  border: '#2A2C22',
  error: '#FF858C',
  warning: '#EFB54A',
  success: '#83C394',
  // Cool counterpart to the amber light: the LAN / sonar signal. Amber is
  // radio proximity (BLE); this cool blue is network reachability. Use it for
  // lines, rings, and sweeps — not large fills, so the amber stays brightest.
  cool: '#BFD7EA',
};

module.exports = { theme };
