## Beyond20 Custom Remix has just been installed or updated

Congratulations! Beyond20 Custom Remix is now at version 2.21.1. It is based on Beyond20 v2.21.0 and adds the Roll20 quick roll launcher on top of it.

Have a look at the [Features](features) page to see what it can do, and the [Install](install) page if you are setting it up on another browser.

* [New in this fork](#new-in-this-fork)
* [Known issues](#known-issues)
* [Release notes](#release-notes)
* [Changelog](#changelog)

# New in this fork

## Roll20 Quick Roll Launcher

Roll a skill, saving throw or ability check from the Roll20 page, without switching tabs. A floating button on the Roll20 page shows your D&D Beyond character's portrait; click it, pick a roll, and it is made on your real D&D Beyond character sheet so every class feature, effect and custom modifier applies. The result appears in the Roll20 chat as usual, and your D&D Beyond tab stays in the background.

It remembers which character you play in each Roll20 game, supports several open sheets, and has light and dark themes with a choice of text and highlight colour. If you would rather not have it, untick **Show the quick roll launcher in Roll20** in the extension's options under the VTT tab.

# Known issues

{% include_relative known_issues.md %}

# Release notes

v2.21.1 — Beyond20 Custom Remix
===

The first release of this fork. It is Beyond20 v2.21.0 with the Roll20 quick roll launcher added, and with the fork's own name and version numbering so that it can sit alongside the official Beyond20 without being confused for it.

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
