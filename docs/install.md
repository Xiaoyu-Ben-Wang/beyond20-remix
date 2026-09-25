# Installation

Beyond20 Custom Remix is **not** published to the Chrome Web Store, Firefox Add-ons or the Edge Add-ons store. It is installed from source, either by downloading a packaged release or by building it yourself.

If you have the official Beyond20 installed from one of the stores, **disable it first**. Both extensions do the same job, and leaving both enabled means both will answer the same rolls.

## Install a packaged release

Head to the [latest release](https://github.com/Xiaoyu-Ben-Wang/beyond20-remix/releases/latest) and download the archive for your browser:

* [Chrome / Edge / Brave (`.zip`)](https://github.com/Xiaoyu-Ben-Wang/beyond20-remix/releases/latest/download/beyond_20-2.21-remix.1-chrome.zip)
* [Firefox (`.zip`)](https://github.com/Xiaoyu-Ben-Wang/beyond20-remix/releases/latest/download/beyond_20-2.21-remix.1-firefox.zip)

The archive names are tied to the release tag, so if a newer release exists those direct links may have moved on — the [releases page](https://github.com/Xiaoyu-Ben-Wang/beyond20-remix/releases) is always the authoritative list.

Extract the archive in a directory of your choice, then follow the instructions for your browser below.

## Chrome, Edge and other Chromium browsers

1. Go to the Extensions page (Menu &rarr; More Tools &rarr; Extensions, or `chrome://extensions`)
2. Enable **Developer mode** (top-right corner)
3. Click **Load unpacked**
4. Select the directory where you extracted the extension

## Firefox

[![Mozilla Firefox](images/firefox-logo-horizontal-lockup.png)](https://www.mozilla.org/firefox/)

1. Open `about:debugging#/runtime/this-firefox` in Firefox
2. Click **Load Temporary Add-on**
3. Select the `manifest.json` file from the extension's directory

**Note:** Firefox only allows unsigned extensions as temporary add-ons, so this installation is removed when Firefox restarts and you will need to load it again. This is a limitation of Firefox rather than of this extension. On Firefox Developer Edition and Nightly you can set `xpinstall.signatures.required` to `false` in `about:config` for a permanent install.

## Build it yourself

You need [Node.js](https://nodejs.org/) and npm installed. From the source directory:

1. `npm install` to install the build dependencies
2. `npm run build` to build the extension into `build/chrome/` and `build/firefox/`
3. `npm test` to run the test suite
4. `npm run package` to produce the packaged zips in `build/artifacts/`

You can then load `build/chrome/` or `build/firefox/` as described above. The `npm run start:chrome` and `npm run start:firefox` scripts launch a browser with the extension loaded, which is the quickest way to try a change.

## Source code

The source is on [GitHub](https://github.com/Xiaoyu-Ben-Wang/beyond20-remix). The `-src.zip` archive attached to each release contains the source tree for that release.
