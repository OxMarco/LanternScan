# LanternScan store release

The iOS app is already published. This folder tracks the Android-specific work
that still has to happen outside the repository.

## Google Play listing draft

- App name: `LanternScan`
- Package name: `com.scanwithlantern.app`
- App or game: App
- Category: Tools
- Default language: English (United States)
- Contact website: `https://scanwithlantern.com/`
- Privacy policy: `https://scanwithlantern.com/privacy`

Short description (80-character limit):

> Discover nearby Bluetooth and Wi-Fi devices, privately and with clear evidence.

Full description:

> Know what is around you.
>
> LanternScan discovers Bluetooth Low Energy devices nearby and devices sharing
> your Wi-Fi network. It combines broadcast names, services, manufacturers,
> signal strength, and local-network responses to make an evidence-backed guess
> about each device.
>
> Use LanternScan to:
>
> - See nearby Bluetooth devices and estimate rough distance from signal strength
> - Find phones, computers, routers, printers, TVs, and smart-home devices on Wi-Fi
> - Review the evidence behind each identification instead of trusting a black box
> - Mark devices as familiar or flag ones you want to investigate
> - Keep discovery data on your phone by default
>
> LanternScan has no accounts and no ads. Optional online identification is off
> by default. If you enable it, the app clearly explains which device signals are
> sent to Fingerbank for a more precise match.
>
> Bluetooth distance is an estimate, and local-network discovery results depend
> on device and router behavior. LanternScan is an awareness tool, not a guarantee
> that every device will be found or identified correctly.

## Required graphics

- Play icon: export `assets/icon.png` as a 512 x 512, 32-bit PNG.
- Feature graphic: create a 1024 x 500 JPEG or 24-bit PNG with no alpha.
- Phone screenshots: capture the real Android build, including Bluetooth
  discovery, Wi-Fi/LAN discovery, device details, and the privacy-first setting.
  Upload at least two; four to six gives a clearer listing.
- Do not use the demo build for final screenshots unless onboarding is completed
  first and every shown feature accurately matches the production build.

## Play Console declarations

Confirm these answers against the exact binary before submission:

- Ads: No.
- App access: all functionality is available without an account or login.
- Target audience: not designed for children; do not select under-13 groups
  unless the app is deliberately brought into the Families program.
- Content rating: complete the utility-app questionnaire accurately; the app has
  no social, gambling, sexual, violent, or user-generated content.
- Permissions: Nearby devices is used for foreground Bluetooth discovery.
  Location is limited to Android 11 and below because those versions require it
  for BLE scanning; the app does not request GPS coordinates. Network and Wi-Fi
  permissions support local device discovery.
- Data safety: local scan and preference data stays on-device. Optional online
  identification can transmit mDNS services and, when available, hostnames and
  MAC addresses to Fingerbank over HTTPS after explicit opt-in. Because Fingerbank
  may retain that data, review whether Play classifies it as collected/shared
  device identifiers for app functionality; do not declare the app fully offline
  when the production build includes this option.
- Data deletion: there is no account. Users can delete local data by clearing app
  storage or uninstalling. Fingerbank controls data it retains.
- Privacy policy: publish and enter `https://scanwithlantern.com/privacy`; the same
  policy is available inside Settings > Privacy.

## Build and release checklist

1. Run `npm ci`, `npm run doctor`, and `npm run check` from a clean checkout.
2. Produce an installable internal APK with `npm run build:android:preview`.
3. On at least one Android 11 device and one Android 12+ device, verify onboarding,
   permission denial/retry, BLE scan, BLE detail/GATT data, LAN scan, local HTTP
   identification, settings, privacy links, offline behavior, and system back.
4. Test gesture navigation and three-button navigation for bottom-inset overlap.
5. In Play Console, create the app with package `com.scanwithlantern.app`, enable
   Play App Signing, complete Store listing and App content, and create an
   Internal testing release.
6. Run `npm run build:android:production` to create the signed AAB. EAS remote
   versioning and `autoIncrement` manage `versionCode`.
7. Download the first AAB from EAS and upload it manually to Play Console. Google
   requires the first Android upload to be manual before API submissions work.
8. Install from the Internal testing track and repeat the physical-device smoke
   test. Review Play's pre-launch report, automated device results, warnings, and
   the final merged permissions before promotion.
9. After the first manual upload, configure a Google service-account key for EAS
   Submit. Later releases can use `npm run submit:android:production`.
10. Promote through closed/open testing as appropriate, then roll production out
    gradually and monitor Android vitals and reviews.

Do not commit keystores, Google service-account JSON, or the Fingerbank API key.
