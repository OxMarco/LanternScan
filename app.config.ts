import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'LanternScan',
  slug: 'lantern',
  scheme: 'lantern',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'dark',
  backgroundColor: '#090A07',
  icon: './assets/icon.png',
  assetBundlePatterns: ['**/*'],
  experiments: {
    tsconfigPaths: true,
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.scanwithlantern.app',
    config: {
      // Lantern only uses operating-system TLS implementations and does not
      // ship custom or non-exempt cryptography.
      usesNonExemptEncryption: false,
    },
    entitlements: {
      // SSDP/UPnP discovery sends UDP to the multicast group 239.255.255.250,
      // which iOS 14+ blocks unless the app carries this entitlement. It is a
      // restricted entitlement: it takes effect only once Apple approves the
      // request for this App ID (developer.apple.com/contact → "Networking
      // Multicast") and the provisioning profile is regenerated. Until then
      // SSDP stays silent on iOS; mDNS and the TCP sweep are unaffected.
      //
      // Commented out until Apple approves the request — including it before
      // approval invalidates the provisioning profile and breaks device builds.
      // Re-enable once approval lands, then regenerate the provisioning profile.
      // 'com.apple.developer.networking.multicast': true,
    },
    infoPlist: {
      NSLocalNetworkUsageDescription:
        'LanternScan scans your local network to list connected devices and spot intruders.',
      // The SSDP description fetch and the HTTP identification probe talk
      // plain HTTP to RFC-1918 addresses, which ATS blocks by default.
      NSAppTransportSecurity: { NSAllowsLocalNetworking: true },
      // iOS only allows browsing Bonjour service types declared here.
      NSBonjourServices: [
        '_device-info._tcp',
        '_airplay._tcp',
        '_raop._tcp',
        '_companion-link._tcp',
        '_googlecast._tcp',
        '_ipp._tcp',
        '_ipps._tcp',
        '_printer._tcp',
        '_pdl-datastream._tcp',
        '_scanner._tcp',
        '_uscan._tcp',
        '_http._tcp',
        '_https._tcp',
        '_ssh._tcp',
        '_sftp-ssh._tcp',
        '_smb._tcp',
        '_afpovertcp._tcp',
        '_workstation._tcp',
        '_rfb._tcp',
        '_hap._tcp',
        '_matter._tcp',
        '_matterc._udp',
        '_meshcop._udp',
        '_sonos._tcp',
        '_spotify-connect._tcp',
        '_androidtvremote2._tcp',
        '_amzn-wplay._tcp',
        '_daap._tcp',
        '_hap._udp',
        '_hue._tcp',
        '_nanoleafapi._tcp',
        '_nanoleafms._tcp',
        '_wled._tcp',
        '_elg._tcp',
        '_shelly._tcp',
        '_esphomelib._tcp',
        '_miio._udp',
        '_axis-video._tcp',
        '_viziocast._tcp',
        '_soundtouch._tcp',
        '_heos-audio._tcp',
        '_linkplay._tcp',
        '_bangolufsen._tcp',
        '_devialet-http._tcp',
        '_plexmediasvr._tcp',
        '_xbmc-jsonrpc-h._tcp',
        '_octoprint._tcp',
        '_ecobee._tcp',
        '_lutron._tcp',
        '_fbx-api._tcp',
        '_airport._tcp',
        '_amzn-alexa._tcp',
        '_appletv-v2._tcp',
        '_mediaremotetv._tcp',
        '_homeconnect._tcp',
        '_mieleathome._tcp',
        '_nut._tcp',
        '_enphase-envoy._tcp',
        '_homewizard._tcp',
        '_hwenergy._tcp',
        '_powerview._tcp',
        '_zigbee-coordinator._tcp',
        '_zwave-js-server._tcp',
      ],
    },
  },
  android: {
    package: 'com.scanwithlantern.app',
    allowBackup: false,
    adaptiveIcon: {
      foregroundImage: './assets/icon.png',
      monochromeImage: './assets/monotone.png',
      backgroundColor: '#090A07',
    },
    permissions: [
      'android.permission.ACCESS_NETWORK_STATE',
      'android.permission.ACCESS_WIFI_STATE',
      'android.permission.CHANGE_WIFI_MULTICAST_STATE',
      'android.permission.ACCESS_FINE_LOCATION',
    ],
    blockedPermissions: [
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.SYSTEM_ALERT_WINDOW',
    ],
  },
  web: {
    bundler: 'metro',
  },
  plugins: [
    'expo-status-bar',
    [
      'react-native-ble-plx',
      {
        isBackgroundEnabled: false,
        bluetoothAlwaysPermission:
          'LanternScan scans for nearby Bluetooth devices to show what is around you.',
      },
    ],
  ],
  extra: {
    ...config.extra,
    eas: { projectId: 'c2b8b47c-620a-441a-adaf-783b04c0b6a7' },
    // Enables online Fingerbank device enrichment (LAN scans only). Blank keeps
    // Lantern fully offline. Read at runtime via fingerbankConfig.ts.
    //
    // Kept out of this file deliberately: it is the one value here that is a
    // credential. Local builds read it from .env.local; EAS builds read it from
    // the FINGERPRINTBANK_API_KEY secret (eas secret:create). Note this only
    // keeps the key out of the repo — it is still baked into the shipped bundle
    // and recoverable from the binary, as any client-side key is.
    fingerbankApiKey: process.env.FINGERPRINTBANK_API_KEY ?? '',
  },
});
