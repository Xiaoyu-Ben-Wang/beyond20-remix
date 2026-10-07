# Installation

Beyond20 Custom Remix is **not** in the Chrome Web Store, Firefox Add-ons or the Edge Add-ons store. You install it from source. Download a packaged release, then load it into your browser.

If you already have the official Beyond20 from a store, turn it off first. Both extensions do the same job. If you leave both on, both will answer the same rolls.

## Install a packaged release

Go to the [latest release](https://github.com/Xiaoyu-Ben-Wang/beyond20-remix/releases/latest) and download the file for your browser:

* [Chrome / Edge / Brave (`.zip`)](https://github.com/Xiaoyu-Ben-Wang/beyond20-remix/releases/latest/download/beyond_20-2.21-remix.1-chrome.zip)
* [Firefox (`.zip`)](https://github.com/Xiaoyu-Ben-Wang/beyond20-remix/releases/latest/download/beyond_20-2.21-remix.1-firefox.zip)

The file names follow the release tag. If a newer release exists, those direct links may have changed. The [releases page](https://github.com/Xiaoyu-Ben-Wang/beyond20-remix/releases) always has the current list.

Unpack the archive in a folder you choose. Then follow the steps for your browser below.

## Chrome, Edge and other Chromium browsers

1. Open the Extensions page (Menu, then More Tools, then Extensions — or type `chrome://extensions`)
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked**
4. Choose the folder where you unpacked the extension

## Firefox

[![Mozilla Firefox](images/firefox-logo-horizontal-lockup.png)](https://www.mozilla.org/firefox/)

1. Open `about:debugging#/runtime/this-firefox` in Firefox
2. Click **Load Temporary Add-on**
3. Choose the `manifest.json` file in the extension's folder

**Note:** Firefox only allows unsigned extensions as temporary add-ons. Firefox removes the add-on when it restarts, so you must load it again. This is a Firefox rule, not a problem with this extension. On Firefox Developer Edition and Nightly you can set `xpinstall.signatures.required` to `false` in `about:config` to keep it installed.

## Source code

The source is on [GitHub](https://github.com/Xiaoyu-Ben-Wang/beyond20-remix). The `-src.zip` file on each release holds the source for that release.
