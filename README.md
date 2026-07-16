# LanternScan

> Beware of what's lurking in the dark!

LanternScan is free and open-source software licensed under
[GNU GPL v3 or later](LICENSE).

LanternScan is an Expo / React Native app that scans your Wi-Fi/LAN and Bluetooth
surroundings, lists every device it can see, and guesses what each one is. Use it to
spot an unexpected phone, a rogue speaker, or anything that shouldn't be on your
network.

## Release preparation

Store copy, the privacy-policy draft, disclosure guidance, and the final submission
checklist live in [`store/`](store/README.md). Run `npm run check` before producing a
preview or production build.

## Website

The no-build static website lives in [`docs/`](docs/index.html). The Pages workflow
publishes that directory after changes reach `main` or `master`. In the repository’s
GitHub settings, set **Pages → Build and deployment → Source** to **GitHub Actions**.

GitHub assigns the final URL from the repository owner and name. A repository named
`lantern.github.io` under the `lantern` account publishes at `https://lantern.github.io/`;
an `OxMarco/Lantern` project publishes at `https://oxmarco.github.io/Lantern/`.
