const { withAndroidManifest } = require('expo/config-plugins');

// Android blocks cleartext HTTP by default. LanternScan intentionally probes
// private-LAN device pages (for example http://192.168.1.1) because routers,
// printers, and smart-home devices often do not offer HTTPS. The only remote
// service used by the app is hard-coded to an HTTPS URL in fingerbank.ts.
module.exports = function withAndroidReleaseConfig(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    const application = manifest.application?.[0];
    if (!application) throw new Error('Android manifest has no application element');

    application.$['android:usesCleartextTraffic'] = 'true';

    // These permissions are only used on Android 11 and below. Nearby-device
    // permissions replace them on Android 12+, so do not leave the legacy pair
    // declared against newer OS versions.
    const legacyBluetoothPermissions = new Set([
      'android.permission.BLUETOOTH',
      'android.permission.BLUETOOTH_ADMIN',
    ]);
    for (const permission of manifest['uses-permission'] ?? []) {
      if (legacyBluetoothPermissions.has(permission.$['android:name'])) {
        permission.$['android:maxSdkVersion'] = '30';
      }
    }

    return mod;
  });
};
