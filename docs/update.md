## Beyond20 Custom Remix has just been installed or updated

Beyond20 Custom Remix is now at version 2.21.2. It is based on Beyond20 v2.21.0. It adds the Roll20 quick roll launcher on top.

Look at the [demo](demo) to see what it can do. See the [Install](install) page if you are setting it up on another browser.

* [New in this fork](#new-in-this-fork)
* [Known issues](#known-issues)
* [Release notes](#release-notes)
* [Changelog](#changelog)

# New in this fork

## Roll20 Quick Roll Launcher

You can roll a skill, saving throw, ability check or initiative from the Roll20 page. You do not have to switch tabs. A floating button appears on the Roll20 page. It shows your D&D Beyond character's portrait. Click it and pick a roll. The roll happens on your real D&D Beyond character sheet, so every class feature, effect and custom modifier applies. The result appears in the Roll20 chat as usual. Your D&D Beyond tab stays in the background.

Every roll has small **A** and **D** buttons, to roll it with advantage or disadvantage.

Star your favourite attacks and spells on your D&D Beyond sheet: hover a row in your attacks or spells and click the ☆ after its name, or click **Favorite** under "Display in VTT" in its side panel. They appear in the launcher's ★ tab, with their damage and to-hit, and roll from there even while your sheet is showing another tab.

Your hit points are in the launcher's header. Type an amount and click **Heal**, **Damage** or **Temp HP**, and the change is made on your D&D Beyond sheet.

Initiative can go straight into Roll20's turn tracker. That needs your token selected, so if it isn't, the launcher asks you to select it first.

The launcher remembers which character you play in each Roll20 game. It supports several open sheets. It has light and dark themes, and a choice of colour for the text and highlights. If you do not want it, untick **Show the quick roll launcher in Roll20** in the extension's options, under the VTT tab.

# Known issues

{% include_relative known_issues.md %}

# Release notes

v2.21.2 — Beyond20 Custom Remix
===

The quick roll launcher grows up. Every roll now has advantage and disadvantage buttons, your favourite attacks and spells get a tab of their own, initiative can go straight into the turn tracker, and you can heal, take damage and set temporary hit points from the launcher's header.

v2.21.1 — Beyond20 Custom Remix
===

This is the first release of this fork. It is Beyond20 v2.21.0 with the Roll20 quick roll launcher added. It uses the fork's own name and version numbers, so it can sit next to the official Beyond20 without being confused with it.

Nothing was removed from Beyond20. Every roll, every supported VTT and every setting works exactly as it does upstream.

v2.21.0 (September 16th 2026) — upstream Beyond20
===

Hi everyone,

Today, we're releasing v2.21.0 with a new 2024 Bladesong option for Bladesinger wizards, as well as support for the Unarmed Fighting fighting style, and grave touch lock is now working on D&D Beyond.

We've also fixed versatile weapon quick-rolls, HP updates for legacy Roll20 games, and false-positive dice parsing for sourcebook labels such as D1 and D0.

You can read the full [Changelog](Changelog#v2210) below to see all the changes included in this release.

As usual, a big thank you to [@dmportella/Gothyl](https://github.com/dmportella), [@jugarrit](https://github.com/jugarrit), and [@0xguy07](https://github.com/0xguy07) for their work on this release!

---

Click [here](release_notes) for the full release notes from previous versions.

# Changelog

v2.21.2 — Beyond20 Custom Remix
===
- **Feature**: *Roll20*: Advantage and disadvantage buttons on every quick roll
- **Feature**: *Roll20*: Favourite attacks and spells from the D&D Beyond sheet (a star after the name, or Favorite in the side panel) and roll them from the launcher's ★ tab, which shows their damage and to-hit and updates as soon as you star something
- **Feature**: *Roll20*: Roll initiative from the launcher, asking you to select your token first when it should go into the turn tracker
- **Feature**: *Roll20*: Hit points in the launcher's header, with Heal, Damage and Temp HP buttons that change them on the D&D Beyond sheet
- **Bugfix**: *Roll20*: The launcher's panel no longer runs off the top of short windows

v2.21.1 — Beyond20 Custom Remix
===
- **Feature**: *Roll20*: Add the quick roll launcher, which rolls skills, saving throws and ability checks from the Roll20 page without switching to the D&D Beyond tab
- **Feature**: *Roll20*: Remember the character played in each Roll20 campaign, and let several open character sheets be switched between from the panel
- **Feature**: *Roll20*: Light and dark themes, and a configurable colour for the panel's text and highlights

v2.21.0 (September 16th 2026)
===
- **Feature**: *dndbeyond*: Add support for the 2024 Wizard: Bladesinger: Bladesong feature (by [@jugarrit](https://github.com/jugarrit))
- **Feature**: *dndbeyond*: Add support for the Unarmed Fighting fighting style (by [@dmportella](https://github.com/dmportella))
- **Bugfix**: *dndbeyond*: Fix versatile weapon quick-rolls selecting the wrong damage type (by [@dmportella](https://github.com/dmportella))
- **Bugfix**: *Roll20*: Fix HP updates for legacy games (by [@dmportella](https://github.com/dmportella))
- **Bugfix**: Fix false-positive dice parsing for bare D1 and D0 labels (by [@0xguy07](https://github.com/0xguy07))

---

Click [here](Changelog) for the full Changelog of previous versions.
