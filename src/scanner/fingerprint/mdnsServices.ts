export type MdnsServiceHint = {
  label: string;
  confidence: number;
};

// Service types Lantern browses (must stay in sync with NSBonjourServices in
// app.config.ts) mapped to what advertising them implies about the device.
export const MDNS_SERVICE_HINTS: Record<string, MdnsServiceHint> = {
  '_airplay._tcp': { label: 'AirPlay device (Apple TV / smart TV)', confidence: 0.7 },
  '_raop._tcp': { label: 'AirPlay speaker', confidence: 0.6 },
  '_companion-link._tcp': { label: 'Apple device', confidence: 0.5 },
  '_googlecast._tcp': {
    label: 'Google Cast device (Chromecast / smart speaker)',
    confidence: 0.75,
  },
  '_ipp._tcp': { label: 'Printer', confidence: 0.8 },
  '_ipps._tcp': { label: 'Printer', confidence: 0.8 },
  '_printer._tcp': { label: 'Printer', confidence: 0.8 },
  '_pdl-datastream._tcp': { label: 'Printer', confidence: 0.8 },
  '_scanner._tcp': { label: 'Scanner', confidence: 0.75 },
  '_uscan._tcp': { label: 'Scanner', confidence: 0.75 },
  '_hap._tcp': { label: 'HomeKit accessory', confidence: 0.7 },
  '_matter._tcp': { label: 'Matter smart home device', confidence: 0.7 },
  '_matterc._udp': { label: 'Matter smart home device (pairing mode)', confidence: 0.7 },
  '_meshcop._udp': { label: 'Thread border router', confidence: 0.8 },
  '_sonos._tcp': { label: 'Sonos speaker', confidence: 0.85 },
  '_spotify-connect._tcp': { label: 'Spotify Connect speaker', confidence: 0.6 },
  '_androidtvremote2._tcp': { label: 'Android TV', confidence: 0.8 },
  '_amzn-wplay._tcp': { label: 'Amazon Fire TV / Echo', confidence: 0.7 },
  '_smb._tcp': { label: 'File server / NAS', confidence: 0.5 },
  '_afpovertcp._tcp': { label: 'Mac (file sharing)', confidence: 0.6 },
  '_ssh._tcp': { label: 'Computer (SSH enabled)', confidence: 0.45 },
  '_sftp-ssh._tcp': { label: 'Computer (SSH enabled)', confidence: 0.45 },
  '_workstation._tcp': { label: 'Computer', confidence: 0.4 },
  '_rfb._tcp': { label: 'Computer (screen sharing)', confidence: 0.5 },
  '_daap._tcp': { label: 'Computer (media library)', confidence: 0.4 },
  '_http._tcp': { label: 'Web-enabled device', confidence: 0.2 },
  '_https._tcp': { label: 'Web-enabled device', confidence: 0.2 },
  // Vendor-specific types the one-shot mDNS querier can now surface. Each
  // label names the device class in words identity.ts can map to a category.
  '_hap._udp': { label: 'HomeKit accessory (Thread)', confidence: 0.7 },
  '_hue._tcp': { label: 'Philips Hue bridge', confidence: 0.85 },
  '_nanoleafapi._tcp': { label: 'Nanoleaf light panels', confidence: 0.85 },
  '_nanoleafms._tcp': { label: 'Nanoleaf light panels', confidence: 0.85 },
  '_wled._tcp': { label: 'WLED smart light controller', confidence: 0.85 },
  '_elg._tcp': { label: 'Elgato device (Key Light / Stream Deck)', confidence: 0.75 },
  '_shelly._tcp': { label: 'Shelly smart-home device', confidence: 0.85 },
  '_esphomelib._tcp': { label: 'ESPHome device', confidence: 0.8 },
  '_miio._udp': { label: 'Xiaomi smart-home device', confidence: 0.7 },
  '_axis-video._tcp': { label: 'Axis network camera', confidence: 0.85 },
  '_viziocast._tcp': { label: 'Vizio SmartCast TV', confidence: 0.85 },
  '_soundtouch._tcp': { label: 'Bose SoundTouch speaker', confidence: 0.85 },
  '_heos-audio._tcp': { label: 'Denon HEOS speaker', confidence: 0.85 },
  '_linkplay._tcp': { label: 'LinkPlay Wi-Fi speaker', confidence: 0.7 },
  '_bangolufsen._tcp': { label: 'Bang & Olufsen speaker', confidence: 0.85 },
  '_devialet-http._tcp': { label: 'Devialet speaker', confidence: 0.85 },
  '_plexmediasvr._tcp': { label: 'Plex media server', confidence: 0.8 },
  '_xbmc-jsonrpc-h._tcp': { label: 'Kodi media player', confidence: 0.75 },
  '_octoprint._tcp': { label: 'OctoPrint 3D printer controller', confidence: 0.85 },
  '_ecobee._tcp': { label: 'ecobee thermostat', confidence: 0.85 },
  '_lutron._tcp': { label: 'Lutron smart-home bridge', confidence: 0.8 },
  '_fbx-api._tcp': { label: 'Freebox router', confidence: 0.85 },
  '_airport._tcp': { label: 'Apple AirPort base station', confidence: 0.85 },
  '_amzn-alexa._tcp': { label: 'Amazon Echo (Alexa)', confidence: 0.75 },
  '_appletv-v2._tcp': { label: 'Apple TV', confidence: 0.85 },
  '_mediaremotetv._tcp': { label: 'Apple TV', confidence: 0.75 },
  '_homeconnect._tcp': { label: 'Home Connect appliance (Bosch / Siemens)', confidence: 0.85 },
  '_mieleathome._tcp': { label: 'Miele appliance', confidence: 0.85 },
  '_nut._tcp': { label: 'UPS (Network UPS Tools)', confidence: 0.7 },
  '_enphase-envoy._tcp': { label: 'Enphase Envoy solar energy monitor', confidence: 0.85 },
  '_homewizard._tcp': { label: 'HomeWizard energy meter', confidence: 0.8 },
  '_hwenergy._tcp': { label: 'HomeWizard energy meter', confidence: 0.8 },
  '_powerview._tcp': { label: 'Hunter Douglas PowerView shades', confidence: 0.8 },
  '_zigbee-coordinator._tcp': { label: 'Zigbee coordinator', confidence: 0.8 },
  '_zwave-js-server._tcp': { label: 'Z-Wave gateway', confidence: 0.8 },
};

// Service types worth browsing even though they carry no strong identity hint
// on their own (_device-info exposes the Apple model TXT record).
export const BROWSED_MDNS_SERVICES: string[] = Array.from(
  new Set(['_device-info._tcp', ...Object.keys(MDNS_SERVICE_HINTS)])
);
