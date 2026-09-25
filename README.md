Beyond20 Custom Remix: D&D Beyond & Roll20/Foundry VTT Integration
==

A personal fork of [Beyond20](https://beyond20.here-for-more.info/), the browser extension that
integrates the Character Sheet from D&D Beyond into Roll20, Foundry VTT & Discord.

**Documentation: <https://xiaoyu-ben-wang.github.io/beyond20-remix/>** — install instructions,
feature list, FAQ and the privacy policy.

This fork is **not** the official Beyond20 and is not affiliated with or endorsed by the Beyond20
project. It takes upstream's code as its base and adds the changes listed below. Everything
Beyond20 normally does still works; the additions are on top.

It is based on Beyond20 v2.21.0. Its own releases use plain numeric versions (`2.21.1`, `2.21.2`, …)
rather than a `remix` label, because Chrome and Firefox both require the extension version to be
dot-separated integers. The `remix` label lives in the release tag (`v2.21-remix.1`) and the zip
filenames instead.

# Custom features

## Roll20 Quick Roll Launcher

Roll a skill, saving throw or ability check from the Roll20 page, without switching tabs.

* A floating button on the Roll20 page shows your D&D Beyond character's portrait. Click it to
  open a panel of skills, saving throws and ability checks.
* Click a roll and it is performed on your real D&D Beyond character sheet, so class features,
  effects and custom modifiers all apply exactly as if you had clicked the sheet yourself. The
  result appears in the Roll20 chat as usual.
* Your D&D Beyond tab stays in the background and is never brought to the front.
* Remembers which character you play in each Roll20 game, and asks rather than guessing when it
  cannot tell. Several sheets open at once can be switched between from the panel header.
* Light and dark themes, and a choice of colour for the panel's text and highlights.
* Can be turned off in the settings, under the Roll20 tab's options.

See [docs/features.md](docs/features.md) for the full feature list, and
[docs/api.md](docs/api.md) for the two messages this adds to Beyond20's internal API
(`quick-roll-data` and `quick-roll`).

# Use

Open Roll20 or Foundry VTT in a tab of Chrome or Firefox then your character sheet in D&D Beyond in another tab. If you are using Chrome with Foundry VTT, then you need to click on the Beyond20 icon in the Chrome window's toolbar to activate Beyond20 for your FVTT installation.

Click on the item you want to roll, whether it's initiative, a skill, ability or saving throw check, a weapon or spell attack, a class/racial feat or trait or hit dice, death saving throw, etc... When the D&D Beyond character sheet shows the information about the item you selected in its side panel, there should be a Beyond20 button or B20 icon that appear in the side panel to make the roll. It will automatically pick up on what was selected, and send the roll to all Roll20 or Foundry VTT tabs open.

If a spell/item/action/feat description contains a dice formula (`2d10 + 3` for example) or a modifier formula (`+ 3` for example), that text will be underlined and a B20 dice icon will appear next to it. Click on the formula or the dice to make the roll in the Roll20 tab.

If you click on the Beyond20 button in the toolbar, it will pop open the quick settings menu. Note that the quick settings menu will be different whether you are on the VTT tab or D&D Beyond tab, and it will contain the per-character configuration.

# Build

You need to install the build dependencies by running in the source directory:
`npm install`

You can then build the files using the command `npm run build`

Run the tests with `npm test`. Producing the packaged zips for a release is `npm run package`,
which writes them to `build/artifacts/`.

# Developer Mode Installation

This fork is not published to the Chrome Web Store or Firefox Add-ons, so it is installed from
source. All you need is to load the extension from the source :

0. If you have the official Beyond20 installed from the Chrome or Firefox stores, disable it.
   Both extensions do the same job and will otherwise both answer the same rolls.
1. Download the extension for either [Chrome](https://github.com/Xiaoyu-Ben-Wang/beyond20-remix/releases/latest/download/beyond_20-2.21-remix.1-chrome.zip) or [Firefox](https://github.com/Xiaoyu-Ben-Wang/beyond20-remix/releases/latest/download/beyond_20-2.21-remix.1-firefox.zip), or build it yourself with `npm run package`
2. Extract the zip file in a directory of your choice

## Chrome

3. Go to Chrome Extensions page (Menu->More Tools->Extensions)
4. Enable Developer Mode (Top-right corner)
5. Click on the 'Load Unpacked' button
6. Select the Directory where you extracted this extension

## Firefox

3. Open "[about:debugging#/runtime/this-firefox](about:debugging#/runtime/this-firefox)" in Firefox
4. Click "Load Temporary Add-on"
5. Select the `manifest.json` file from the extension's directory

# License

This extension is released under the GPL v3 license. Read the LICENSE file for more details.

The icon image is based on a public domain image from openclipart. I downloaded it from [wikimedia](https://commons.wikimedia.org/wiki/File:Twenty_sided_dice.svg) and subsequently modified it.

The roll badge icons were designed and created by [Jerry Escandon](https://github.com/Jerryescandon) 

The donation icon is a public domain contribution by Fission Strategy, US, downloaded from [thenounproject](https://thenounproject.com/term/donation/15047/)

The 'up' arrow (docs/images/up-arrow.png) used in the screenshots page is a public domain image shared by OCAL on [clker.com](http://www.clker.com/clipart-16838.html)

The options page was copied in part from the `D&D Beyond Toolbox` extension available [here](https://github.com/mouse0270/Beyonds-Toolbox/). The html and css files are licensed under the MIT license which is provided in the LICENSE.MIT file

The condition icons (FVTT-module/beyond20/conditions) are for the most part taken from https://game-icons.net/ and licensed under a Creative Common CC-BY 3.0 License. You can find each icon's source and respective license in the FVTT-module/beyond20/conditions/LICENSE file