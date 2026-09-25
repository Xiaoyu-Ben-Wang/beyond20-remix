# Privacy Policy

**Applies to:** the Beyond20 Custom Remix browser extension and this website.
**Last updated:** 25 September 2026.

Beyond20 Custom Remix is an unofficial fork of [Beyond20](https://github.com/kakaroto/Beyond20). This policy describes what the fork's extension and this site do with your information. It was written by reading the extension's source code, and every claim below can be checked against it.

## The short version

* The extension has **no analytics, no telemetry, no tracking, and no advertising**. It does not report anything to the developer of this fork.
* It does **not** collect your name, email address, or any account information. There is no account, no sign-up and no login.
* Your settings and character data stay in your browser's local extension storage.
* Everything the extension reads from D&D Beyond is used to make rolls happen in the virtual tabletop you already have open. It travels between your own browser tabs, not to a server.
* The **only** time the extension sends anything to a third-party server is if you deliberately set up the optional Discord integration, which posts rolls to the upstream project's Discord bot.

## Data the extension handles

### From D&D Beyond

To make a roll, the extension reads the character sheet content you have open: the character's name and ID, portrait, ability scores, saving throws, skills, level, classes, race, armour class, proficiency bonus, speed, hit points, exhaustion level, conditions, class features, racial traits, feats, actions, spells and their modifiers, and any dice formulas in their descriptions. This is exactly the information needed to render a roll and send it to your tabletop.

The extension does **not** read, store or transmit your D&D Beyond password, cookies, session tokens or account credentials.

**Why:** to perform the roll you asked for, on your real sheet, with all the character's modifiers applied.

### From your virtual tabletop

When you use the Roll20 quick roll launcher, the extension reads the campaign title of the Roll20 game you are in, using it to remember which character you play in that campaign. It also writes roll results, hit point changes and condition changes into the Roll20 game through Roll20's own in-page interface, which is how the roll appears in chat.

### Where that data goes

Between your own tabs, inside your own browser. The D&D Beyond tab and the Roll20 or Foundry VTT tab talk to each other through the extension's internal messaging. No server of ours is involved, and there is no server of ours to be involved.

## What is stored, and where

The extension stores its data in your browser's **local extension storage** (`chrome.storage.local`). It does **not** use synced storage, so nothing is uploaded to Google's or Mozilla's sync servers by this extension. (On first run it may read settings that an older, pre-fork Beyond20 installation left in synced storage, and copy them into local storage.)

| What | Why |
| --- | --- |
| Your extension settings | To remember your preferences, including whether the quick roll launcher is enabled, its theme and colour |
| Per-character settings | Conditions, exhaustion level, and a Discord target, keyed by D&D Beyond character ID |
| Recent Roll20 characters | A list of up to 20 Roll20 campaigns and the D&D Beyond character you last rolled in each, so the quick roll launcher can pick the right sheet |

All of it is deleted when you uninstall the extension, and you can clear it at any time from your browser's extension settings or by removing the extension.

## The only outbound connections

### Discord integration (optional, off unless you set it up)

If — and only if — you enter a Discord secret key in the extension's options, rolls are sent to the Discord bot run by the **upstream Beyond20 project's author** at `beyond20.kicks-ass.org`, which forwards them to the Discord channel you configured. The request contains the roll's content (the roll description, attack and damage information, and the character's name) along with your channel secret.

This service is not run by, controlled by, or affiliated with this fork. If you never configure Discord integration, the extension never contacts that host. You can remove the secret key at any time to stop it.

### D&D Beyond itself

Clicking a spell tooltip makes the extension request that tooltip from D&D Beyond on the page you are already on, and character portraits are loaded from D&D Beyond's image CDN. These are ordinary same-site requests to the website you are using.

### The "what's new" page after an update

When the extension updates, it opens the project's update page in a new tab so you can read the release notes. This is controlled by the **Show changelog** setting, which you can turn off. As of this version that page is the upstream project's website, not this fork's, and the upstream website carries Google Analytics — a third-party analytics service we do not control. If you would rather that page never open, disable **Show changelog** in the extension's options.

### Links you click yourself

The options page contains links to documentation and to this site. They open only when you click them.

## Permissions, and why each one is needed

| Permission | Why the extension asks for it |
| --- | --- |
| `storage` | To save your settings and the per-character data described above |
| `tabs` | To find your open Roll20, Foundry VTT or D&D Beyond tab, and to tell one of them to roll. It reads tab URLs and titles for this, and does not record your browsing history |
| `activeTab`, `scripting` | To add the extension's buttons and the quick roll launcher to the pages you are using |
| `webNavigation` (optional) | Only if you grant it, to support Roll20 games running inside a Discord activity |
| Access to `dndbeyond.com`, `app.roll20.net`, `*.forge-vtt.com`, `beyond20.kicks-ass.org` | The sites the extension integrates with |
| Access to any other site (optional) | Only if you grant it, for custom virtual tabletops and self-hosted Foundry VTT servers |

## What the extension never does

* No analytics, telemetry, crash reporting or usage statistics of any kind.
* No advertising, no affiliate or referral links, no sponsored content.
* No collection of personally identifiable information, health data, financial information, authentication information, personal communications, location, browsing history or keystroke data.
* No data is sold, rented or shared with anyone.
* No third-party scripts or trackers are bundled in, and every script the extension ships is included in the package rather than loaded from a content delivery network.

### Data collection disclosure

For the benefit of the Chrome Web Store and Firefox Add-ons data-usage declarations:

| Category | Collected by this extension |
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

The extension's use of any data obtained through its permissions is limited to the single purpose described above: integrating D&D Beyond character sheets with virtual tabletops.

## This website

This site is a static site published with GitHub Pages. It sets no cookies, runs no analytics, has no tracking scripts, no advertising and no comment system. All of its assets are served from this site or from GitHub.

GitHub, as the host, may record technical information such as IP addresses in its server logs when serving the site. That is outside this project's control and is covered by [GitHub's privacy statement](https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement).

## Third-party services

When you use the extension you are also using services with their own privacy policies, which this project does not control:

* [D&D Beyond](https://www.dndbeyond.com/privacy-policy)
* [Roll20](https://roll20.net/privacy)
* [Foundry VTT](https://foundryvtt.com/article/privacy/)
* [Discord](https://discord.com/privacy)
* [GitHub](https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement) — this website's host and the extension's distribution channel
* The upstream Beyond20 project's Discord bot at `beyond20.kicks-ass.org`, if you enable Discord integration

## Changes to this policy

If this policy changes, the date at the top of this page will change with it. Because the project is developed in public, the full history of this page is visible in the repository's commit history.

## Contact

Questions or concerns about privacy in this fork are best raised as an issue on the [project's issue tracker](https://github.com/Xiaoyu-Ben-Wang/beyond20-remix/issues). For questions about the upstream Beyond20 extension that this fork is based on, see the [upstream project](https://github.com/kakaroto/Beyond20).
