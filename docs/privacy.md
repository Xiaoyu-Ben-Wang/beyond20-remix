# Privacy Policy

**Applies to:** the Beyond20 Custom Remix browser extension (the "Extension") and this website (the "Website").
**Last updated:** 25 September 2026.

Beyond20 Custom Remix is an unofficial fork of [Beyond20](https://github.com/kakaroto/Beyond20). This Privacy Policy describes how the Extension and the Website handle information. It was prepared from the Extension's source code, and each statement below can be verified against it.

The Extension performs no analytics, telemetry, tracking or advertising, and transmits no information to the developer of this fork. No account, registration or login is required or offered.

## Information the Extension accesses

### D&D Beyond character data

To perform a roll, the Extension reads the character sheet open in your browser: the character's name and identifier, portrait, ability scores, saving throws, skills, level, classes, race, armour class, proficiency bonus, speed, hit points, exhaustion level, conditions, class features, racial traits, feats, actions, spells and their modifiers, and any dice formulas contained in their descriptions. This is the minimum information required to calculate a roll and transmit it to your virtual tabletop.

The Extension does not access your D&D Beyond password, cookies, session tokens or account credentials.

### Virtual tabletop data

When the Roll20 quick roll launcher is used, the Extension reads the campaign title of the Roll20 game you are in, in order to record which character you play in that campaign. The Extension also writes roll results, hit point changes and condition changes into that game through Roll20's own in-page interface, which is how those results appear in the chat.

### Transmission

Information is exchanged only between your own browser tabs, through the Extension's internal messaging. No server operated by this fork receives it, and no such server exists.

## Data storage

The Extension stores all data in your browser's local extension storage (`chrome.storage.local`). It does not use synchronised storage, and therefore does not upload data to Google's or Mozilla's sync services. On first run, the Extension may read settings left in synchronised storage by a prior, pre-fork installation of Beyond20 and copy them into local storage.

| Data | Purpose |
| --- | --- |
| Extension settings | To retain your preferences, including whether the quick roll launcher is enabled, and its theme and colour |
| Per-character settings | Conditions, exhaustion level and a Discord target, keyed by D&D Beyond character identifier |
| Recent Roll20 characters | A list of up to 20 Roll20 campaigns and the D&D Beyond character most recently used in each, so that the launcher can select the correct sheet |

All stored data is deleted when the Extension is uninstalled, and may be cleared at any time through your browser's extension settings.

## Outbound connections

### Discord integration (optional; disabled unless configured)

If, and only if, you enter a Discord secret key in the Extension's options, roll data is transmitted to the Discord bot operated by the author of the upstream Beyond20 project at `beyond20.kicks-ass.org`, which forwards it to the Discord channel you have configured. The request contains the content of the roll — its description, attack and damage information, and the character's name — together with your channel secret.

That service is not operated by, controlled by, or affiliated with this fork. If Discord integration is not configured, the Extension does not contact that host. Removing the secret key disables the integration.

### D&D Beyond

Selecting a spell tooltip causes the Extension to request that tooltip from D&D Beyond on the page you are already viewing, and character portraits are loaded from D&D Beyond's image CDN. These are ordinary same-site requests to the website you are using.

### The "what's new" page after an update

Following an update, the Extension opens the project's update page in a new tab so that the release notes can be read. This behaviour is controlled by the **Show changelog** setting, which can be disabled. As of this version, that page belongs to the upstream project rather than to this fork, and the upstream website uses Google Analytics, a third-party analytics service outside this project's control. Disable **Show changelog** if you do not wish that page to open.

### Links

The options page contains links to documentation and to this site. These open only when selected.

## Permissions

| Permission | Purpose |
| --- | --- |
| `storage` | To save your settings and the per-character data described above |
| `tabs` | To locate your open Roll20, Foundry VTT or D&D Beyond tab and instruct it to roll. Tab URLs and titles are read for this purpose; browsing history is not recorded |
| `activeTab`, `scripting` | To add the Extension's buttons and the quick roll launcher to the pages you are using |
| `webNavigation` (optional) | Only if granted, to support Roll20 games running within a Discord activity |
| Access to `dndbeyond.com`, `app.roll20.net`, `*.forge-vtt.com`, `beyond20.kicks-ass.org` | The sites with which the Extension integrates |
| Access to any other site (optional) | Only if granted, for custom virtual tabletops and self-hosted Foundry VTT servers |

## Data the Extension does not collect or disclose

* No analytics, telemetry, crash reporting or usage statistics of any kind.
* No advertising, no affiliate or referral links, no sponsored content.
* No collection of personally identifiable information, health data, financial information, authentication information, personal communications, location, browsing history or keystroke data.
* No data is sold, rented or disclosed to any third party.
* No third-party scripts or trackers are bundled in, and every script the Extension ships is included in the package rather than loaded from a content delivery network.

### Data collection disclosure

For the benefit of the Chrome Web Store and Firefox Add-ons data-usage declarations:

| Category | Collected by this Extension |
| --- | --- |
| Personally identifiable information | No |
| Health information | No |
| Financial and payment information | No |
| Authentication information | No |
| Personal communications | No |
| Location | No |
| Web history | No |
| User activity | No |
| Website content | No — sheet content is read locally to perform rolls and is not transmitted to the developer |

Use of any data obtained through the Extension's permissions is limited to the single purpose described above: integrating D&D Beyond character sheets with virtual tabletops.

## The Website

The Website is a static site published with GitHub Pages. It sets no cookies, and runs no analytics, tracking scripts, advertising or comment system. All of its assets are served from this site or from GitHub.

The [demo page](demo) is the one page that executes JavaScript, because a simulation of the quick roll launcher cannot work without it. That script draws the simulation and generates random dice results within your browser: it makes no network requests, sets no cookies, writes nothing to storage, and transmits nothing.

GitHub, as the hosting provider, may record technical information such as IP addresses in its server logs when serving the site. This is outside this project's control and is covered by [GitHub's privacy statement](https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement).

## Third-party services

Use of the Extension also involves services with their own privacy policies, which this project does not control:

* [D&D Beyond](https://www.dndbeyond.com/privacy-policy)
* [Roll20](https://roll20.net/privacy)
* [Foundry VTT](https://foundryvtt.com/article/privacy/)
* [Discord](https://discord.com/privacy)
* [GitHub](https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement) — this Website's host and the Extension's distribution channel
* The upstream Beyond20 project's Discord bot at `beyond20.kicks-ass.org`, if Discord integration is enabled

## Changes to this Privacy Policy

Any change to this Privacy Policy will be reflected in the date at the top of this page. As the project is developed in public, the full revision history of this page is available in the repository's commit history.

## Contact

Questions or concerns regarding privacy in this fork should be raised on the [project's issue tracker](https://github.com/Xiaoyu-Ben-Wang/beyond20-remix/issues). For questions regarding the upstream Beyond20 extension on which this fork is based, refer to the [upstream project](https://github.com/kakaroto/Beyond20).
