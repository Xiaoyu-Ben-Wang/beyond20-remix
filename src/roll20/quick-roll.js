/*from src/common/utils.js import E, roll20Title;
  from src/common/settings.js import storageGet, storageSet;*/

// The Roll20 half of the quick roll launcher: a floating portrait button opening a panel
// of skills, saves and ability checks. A click sends the roll to the D&D Beyond tab,
// which performs it on the real sheet and feeds the result back through the normal roll
// pipeline, so the player never leaves Roll20.
// The D&D Beyond half is in src/dndbeyond/content-scripts/quick-roll.js.

const QUICK_ROLL_STORAGE_KEY = "roll20-quick-roll";
// Cap on the campaign-keyed remembered-character map.
const QUICK_ROLL_MAX_CAMPAIGNS = 20;
const QUICK_ROLL_LAUNCHER_ID = "beyond20-quick-roll-launcher";
const QUICK_ROLL_PANEL_ID = "beyond20-quick-roll-panel";

const QUICK_ROLL_ABILITY_ORDER = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];

// Roll20's own vertical toolbar hugs the left edge, so clear it.
const QUICK_ROLL_EDGE_OFFSET = 56;
const QUICK_ROLL_LAUNCHER_SIZE = 42;
const QUICK_ROLL_LAUNCHER_BOTTOM = 72;
const QUICK_ROLL_PANEL_GAP = 10;

let quick_roll_data = null;      // the character whose rolls the panel is showing
let quick_roll_characters = [];  // every sheet that answered, each a full payload
let quick_roll_picker_open = false;
let quick_roll_panel_open = false;
// Bumped per request, so a slow answer cannot overwrite a newer one.
let quick_roll_request_id = 0;

// Decide which responding D&D Beyond tab the player is playing. Never falls back to
// "most recently used": a wrong character's roll looks exactly like a successful one, so
// an ambiguous situation asks rather than guesses. Returns "none", "ready", "picker" or
// "stale".
function selectQuickRollCharacter(responders, remembered) {
    const characters = (responders || []).filter((r) => r && r.id);
    if (characters.length === 0)
        return { state: "none" };

    if (remembered && remembered.id) {
        const match = characters.find((c) => String(c.id) === String(remembered.id));
        if (match)
            return { state: "ready", character: match };
        return { state: "stale", remembered, characters };
    }

    if (characters.length === 1)
        return { state: "ready", character: characters[0] };

    return { state: "picker", characters };
}

// Keyed by campaign title, as the rest of Beyond20 identifies a Roll20 game.
function quickRollCampaignKey() {
    return roll20Title(document.title || "");
}

function getRememberedQuickRollCharacter(cb) {
    const key = quickRollCampaignKey();
    storageGet(QUICK_ROLL_STORAGE_KEY, {}, (all) => cb((all && all[key]) || null));
}

function rememberQuickRollCharacter(id, name, cb = null) {
    if (!id) return;
    const key = quickRollCampaignKey();
    storageGet(QUICK_ROLL_STORAGE_KEY, {}, (all) => {
        const map = all || {};
        map[key] = { id: String(id), name: name || "" };

        // Object keys iterate in insertion order, so the oldest go first.
        const keys = Object.keys(map);
        for (const stale of keys.slice(0, keys.length - QUICK_ROLL_MAX_CAMPAIGNS))
            delete map[stale];

        storageSet(QUICK_ROLL_STORAGE_KEY, map, cb);
    });
}

// Learn a campaign's character from an inbound roll. Monsters are excluded: their ids
// never match a sheet and would silently disable the launcher.
function observeQuickRollCharacter(character) {
    if (!character || !character.id || character.type !== "Character")
        return;

    getRememberedQuickRollCharacter((remembered) => {
        if (!remembered || String(remembered.id) !== String(character.id))
            rememberQuickRollCharacter(character.id, character.name);
    });
}

function requestQuickRollData(callback) {
    try {
        chrome.runtime.sendMessage({ action: "quick-roll-data" }, (response) => {
            if (chrome.runtime.lastError) {
                console.log("Beyond20: quick roll data failed:", chrome.runtime.lastError.message);
                return callback(null);
            }
            callback(response);
        });
    } catch (err) {
        // Thrown when the extension was reloaded but this page was not.
        console.log("Beyond20: quick roll data unavailable, reload the page:", err);
        callback(null);
    }
}

function sendQuickRoll(rollType, name, callback) {
    try {
        const characterId = quick_roll_data && quick_roll_data.id;
        chrome.runtime.sendMessage(
            { action: "quick-roll", characterId: String(characterId), rollType: rollType, name: name },
            (response) => {
                if (chrome.runtime.lastError) {
                    console.log("Beyond20: quick roll failed:", chrome.runtime.lastError.message);
                    return callback({ ok: false, reason: "no-tab" });
                }
                callback(response || { ok: false, reason: "no-tab" });
            }
        );
    } catch (err) {
        console.log("Beyond20: quick roll unavailable, reload the page:", err);
        callback({ ok: false, reason: "disconnected" });
    }
}

// dist/beyond20.css never reaches a Roll20 editor tab, so the panel carries its own
// styles. Roll20 styles bare elements globally, hence the resets on roots and buttons.
const QUICK_ROLL_CSS = `
#${QUICK_ROLL_LAUNCHER_ID}, #${QUICK_ROLL_PANEL_ID} {
    /* Dark is the base theme; the light and per-colour blocks below redefine these. The
       data-b20-qr-* attributes applyQuickRollAppearance sets on both roots choose. */
    --b20-qr-accent: #96bf6b;
    --b20-qr-accent-soft: rgba(150, 191, 107, 0.16);
    /* Launcher hover ring only: the accent a step away from the panel, so the hover
       reads whatever colour was picked. */
    --b20-qr-accent-bright: #b3d78e;
    --b20-qr-bg: #1c1d1f;
    --b20-qr-border: #3a3d42;
    --b20-qr-text: #e6e7e8;
    --b20-qr-dim: #9aa0a6;
    /* Header/tab-row gradient ends, and the wash behind non-accent hovered controls. */
    --b20-qr-raised-1: #2c2f34;
    --b20-qr-raised-2: #232528;
    --b20-qr-hover: rgba(255, 255, 255, 0.08);
    --b20-qr-overlay: rgba(18, 19, 21, 0.94);
    /* Follows --b20-qr-text unless the player chose a colour. */
    --b20-qr-label: var(--b20-qr-text);
    /* Tab row height, and where the status line sits above it. */
    --b20-qr-tabs-h: 30px;
    box-sizing: border-box;
    font-family: Roboto Condensed, Roboto, Helvetica, sans-serif;
    font-size: 12px;
    line-height: 1.35;
    color: var(--b20-qr-text);
}
#${QUICK_ROLL_LAUNCHER_ID} *, #${QUICK_ROLL_PANEL_ID} * { box-sizing: border-box; }
/* Tabs are toggled with [hidden], and the display rules below are class selectors, so
   they would otherwise beat the user agent's own [hidden] rule. */
#${QUICK_ROLL_PANEL_ID} .beyond20-qr-tabs[hidden] { display: none; }
/* :where() adds no specificity, so the component rules below can still override this
   reset; the id alone would otherwise beat every one of them. */
:where(#${QUICK_ROLL_LAUNCHER_ID}, #${QUICK_ROLL_PANEL_ID}) button {
    font-family: inherit;
    font-size: inherit;
    line-height: inherit;
    color: inherit;
    background: none;
    border: 0;
    margin: 0;
    padding: 0;
    text-transform: none;
    letter-spacing: normal;
    cursor: pointer;
}
#${QUICK_ROLL_LAUNCHER_ID} {
    position: fixed;
    left: ${QUICK_ROLL_EDGE_OFFSET}px;
    bottom: ${QUICK_ROLL_LAUNCHER_BOTTOM}px;
    width: ${QUICK_ROLL_LAUNCHER_SIZE}px;
    height: ${QUICK_ROLL_LAUNCHER_SIZE}px;
    padding: 0;
    border-radius: 50%;
    overflow: hidden;
    border: 2px solid var(--b20-qr-accent);
    background: var(--b20-qr-bg);
    box-shadow: 0 2px 10px rgba(0,0,0,0.55);
    z-index: 2147483000;
    display: block;
    margin: 0;
    cursor: pointer;
    /* Pinned against a stray transform-origin from Roll20, which would tilt the hover
       scale instead of growing the button about its middle. */
    transform-origin: center;
    transition: transform 0.16s cubic-bezier(0.2, 0.9, 0.3, 1.4),
                box-shadow 0.16s ease, border-color 0.16s ease;
}
/* Brighter than the accent rather than a fixed green, so hovering follows the chosen
   colour. */
#${QUICK_ROLL_LAUNCHER_ID}:hover, #${QUICK_ROLL_LAUNCHER_ID}:focus-visible {
    border-color: var(--b20-qr-accent-bright);
    box-shadow: 0 6px 18px rgba(0,0,0,0.6), 0 0 0 4px var(--b20-qr-accent-soft);
}
/* Scale, never translate: lift dwarfs the fraction of a pixel scaling adds to the bottom
   edge, so the button looked like it grew upwards rather than evenly outwards. :hover
   alone, so tabbing to it does not move it. */
#${QUICK_ROLL_LAUNCHER_ID}:hover { transform: scale(1.08); }
#${QUICK_ROLL_LAUNCHER_ID}:active { transform: scale(0.94); }
#${QUICK_ROLL_LAUNCHER_ID} img { width: 100%; height: 100%; object-fit: cover; display: block; }
/* Breathes while a roll is in flight, so a slow D&D Beyond tab reads as "working"
   rather than a click that did nothing. */
#${QUICK_ROLL_LAUNCHER_ID}.beyond20-qr-busy img { animation: beyond20-qr-pulse 1s ease-in-out infinite; }
@keyframes beyond20-qr-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
}

#${QUICK_ROLL_PANEL_ID} {
    position: fixed;
    left: ${QUICK_ROLL_EDGE_OFFSET}px;
    bottom: ${QUICK_ROLL_LAUNCHER_BOTTOM + QUICK_ROLL_LAUNCHER_SIZE + QUICK_ROLL_PANEL_GAP}px;
    width: 272px;
    max-height: min(88vh, 640px);
    display: flex;
    flex-direction: column;
    background: var(--b20-qr-bg);
    border: 1px solid var(--b20-qr-border);
    border-radius: 10px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.65);
    z-index: 2147483000;
    overflow: hidden;
    /* Bottom-anchored, so the panel grows upwards and the tabs stay put. */
    transform-origin: bottom left;
    /* A class, not [hidden], so there is something to animate from and to. visibility
       (not display) keeps the element alive through the transition, and its zero-length
       transition is delayed on the way out so the panel stays visible while closing. */
    opacity: 0;
    visibility: hidden;
    transform: translateY(8px) scale(0.96);
    transition: opacity 0.14s ease,
                transform 0.16s cubic-bezier(0.2, 0.9, 0.3, 1.2),
                visibility 0s linear 0.18s;
}
#${QUICK_ROLL_PANEL_ID}.beyond20-qr-open {
    opacity: 1;
    visibility: visible;
    transform: none;
    transition: opacity 0.16s ease,
                transform 0.22s cubic-bezier(0.2, 0.9, 0.3, 1.2),
                visibility 0s;
}
.beyond20-qr-header {
    /* Anchor for the character menu hanging below. */
    position: relative;
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 6px 8px;
    background: linear-gradient(180deg, var(--b20-qr-raised-1), var(--b20-qr-raised-2));
    border-bottom: 1px solid var(--b20-qr-border);
}
/* Child selectors on purpose: the character menu nests in the header to hang off its
   bottom edge, and a descendant selector would resize the menu's avatars and force its
   buttons to 20x20, squeezing the names out. */
.beyond20-qr-header > img {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    object-fit: cover;
    flex: 0 0 auto;
    border: 1px solid var(--b20-qr-border);
}
.beyond20-qr-name { flex: 1 1 auto; font-weight: bold; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.beyond20-qr-header > button {
    flex: 0 0 auto;
    width: 20px;
    height: 20px;
    border-radius: 4px;
    color: var(--b20-qr-dim);
    line-height: 1;
    transition: color 0.12s ease, background 0.12s ease;
}
.beyond20-qr-header > button:hover { color: var(--b20-qr-text); background: var(--b20-qr-hover); }
/* Only shown when more than one sheet answered. */
.beyond20-qr-switch { font-size: 14px; }
.beyond20-qr-switch.beyond20-qr-active { color: var(--b20-qr-accent); background: var(--b20-qr-hover); }
/* Laid over the rolls, not in place of them, so opening it cannot resize the panel and
   move what the player was aiming at. */
.beyond20-qr-char-menu {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    z-index: 2;
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 6px;
    max-height: 156px;
    overflow-y: auto;
    background: var(--b20-qr-raised-1);
    border-bottom: 1px solid var(--b20-qr-border);
    box-shadow: 0 8px 16px rgba(0,0,0,0.35);
}
/* display: flex above would otherwise beat the user agent's [hidden] rule. */
.beyond20-qr-char-menu[hidden] { display: none; }
.beyond20-qr-char-menu button {
    display: flex;
    align-items: center;
    gap: 5px;
    max-width: 100%;
    padding: 3px 7px 3px 3px;
    border-radius: 12px;
    color: var(--b20-qr-text);
    transition: background 0.12s ease;
}
.beyond20-qr-char-menu button:hover { background: var(--b20-qr-hover); }
.beyond20-qr-char-menu button.beyond20-qr-active {
    background: var(--b20-qr-accent-soft);
    color: var(--b20-qr-accent);
}
.beyond20-qr-char-menu img {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    object-fit: cover;
    flex: 0 0 auto;
}
.beyond20-qr-char-menu span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.beyond20-qr-body { overflow-y: auto; padding: 4px; flex: 1 1 auto; min-height: 0; }
/* One list, not columns: the parent ability is named once down the left of its group,
   scannable without spending a row per ability the way a heading would. */
.beyond20-qr-group {
    display: grid;
    grid-template-columns: 26px minmax(0, 1fr);
    column-gap: 6px;
    align-items: start;
}
/* Saves and checks have no grouping, so they skip the label column. */
.beyond20-qr-items { min-width: 0; }
.beyond20-qr-group > .beyond20-qr-items { grid-column: 2; }
.beyond20-qr-group-label {
    padding: 2px 0;
    color: var(--b20-qr-dim);
    font-size: 9px;
    font-weight: bold;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}
.beyond20-qr-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    width: 100%;
    min-width: 0;
    padding: 2px 6px;
    text-align: left;
    border-radius: 4px;
    /* Inset, not a border, so highlighting cannot change the row's size. */
    box-shadow: inset 0 0 0 0 transparent;
    transition: background 0.1s ease, box-shadow 0.1s ease;
}
.beyond20-qr-row:hover, .beyond20-qr-row:focus-visible {
    background: var(--b20-qr-accent-soft);
    box-shadow: inset 2px 0 0 0 var(--b20-qr-accent);
}
.beyond20-qr-row > span:first-child {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--b20-qr-label);
}
.beyond20-qr-row .beyond20-qr-mod {
    flex: 0 0 auto;
    min-width: 24px;
    padding: 0 4px;
    border-radius: 8px;
    background: var(--b20-qr-accent-soft);
    color: var(--b20-qr-accent);
    font-size: 11px;
    font-weight: bold;
    text-align: center;
}
.beyond20-qr-picker { display: flex; flex-wrap: wrap; gap: 6px; padding: 9px; }
.beyond20-qr-picker button {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    width: 64px;
    padding: 5px 2px;
    border-radius: 6px;
    transition: background 0.12s ease;
}
.beyond20-qr-picker button:hover { background: var(--b20-qr-hover); }
.beyond20-qr-picker img {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid transparent;
    transition: border-color 0.12s ease;
}
.beyond20-qr-picker button:hover img { border-color: var(--b20-qr-accent); }
/* The shown character is ringed, not hidden: picking it is the way out of the switcher. */
.beyond20-qr-picker button.beyond20-qr-active img { border-color: var(--b20-qr-accent); }
.beyond20-qr-picker button.beyond20-qr-active { background: var(--b20-qr-accent-soft); }
.beyond20-qr-picker button.beyond20-qr-active span { color: var(--b20-qr-accent); }
.beyond20-qr-picker span { font-size: 10px; text-align: center; overflow: hidden; text-overflow: ellipsis; width: 100%; }
.beyond20-qr-notice { padding: 11px; color: var(--b20-qr-text); }
.beyond20-qr-notice button {
    display: block;
    margin-top: 8px;
    padding: 4px 10px;
    border: 1px solid var(--b20-qr-border);
    border-radius: 5px;
    transition: border-color 0.12s ease, background 0.12s ease;
}
.beyond20-qr-notice button:hover { border-color: var(--b20-qr-accent); background: var(--b20-qr-accent-soft); }
.beyond20-qr-tabs {
    display: flex;
    flex: 0 0 auto;
    background: linear-gradient(180deg, var(--b20-qr-raised-2), var(--b20-qr-raised-1));
}
.beyond20-qr-tabs button {
    flex: 1 1 0;
    height: var(--b20-qr-tabs-h);
    color: var(--b20-qr-dim);
    /* Adjacent buttons form one rule across the tab row's top, with the active one's
       segment in the accent colour. */
    border-top: 2px solid var(--b20-qr-border);
    transition: color 0.12s ease, background 0.12s ease, border-color 0.12s ease;
}
.beyond20-qr-tabs button:hover { color: var(--b20-qr-text); background: var(--b20-qr-hover); }
.beyond20-qr-tabs button.beyond20-qr-active { color: var(--b20-qr-accent); border-top-color: var(--b20-qr-accent); }
/* An overlay, not a row: a long message must not change the panel's height and slide the
   tabs out from under the pointer. */
.beyond20-qr-status {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 4px 9px;
    background: var(--b20-qr-overlay);
    border-top: 1px solid var(--b20-qr-border);
    color: var(--b20-qr-dim);
    font-size: 11px;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.15s ease;
}
/* Set by setQuickRollTabsVisible: the status sits on the tabs when they show, on the
   panel's own edge when they do not. */
.beyond20-qr-has-tabs .beyond20-qr-status { bottom: var(--b20-qr-tabs-h); }
.beyond20-qr-status:not(:empty) { opacity: 1; }

/* Theme: the rules above are dark, so only light needs a block. */
#${QUICK_ROLL_LAUNCHER_ID}[data-b20-qr-theme="light"], #${QUICK_ROLL_PANEL_ID}[data-b20-qr-theme="light"] {
    --b20-qr-bg: #f7f8f9;
    --b20-qr-border: #c9ced5;
    --b20-qr-text: #24262a;
    --b20-qr-dim: #6a707a;
    --b20-qr-raised-1: #ffffff;
    --b20-qr-raised-2: #e9ecf0;
    --b20-qr-hover: rgba(0, 0, 0, 0.07);
    --b20-qr-overlay: rgba(247, 248, 249, 0.95);
}

/* Text and highlight colour. Dark values first; the light block repeats each with a
   deeper value so the choice stays legible on a pale panel. */
#${QUICK_ROLL_LAUNCHER_ID}[data-b20-qr-color="green"], #${QUICK_ROLL_PANEL_ID}[data-b20-qr-color="green"] {
    --b20-qr-accent: #96bf6b; --b20-qr-accent-soft: rgba(150, 191, 107, 0.16); --b20-qr-label: #a8d47f;
    --b20-qr-accent-bright: #b3d78e;
}
#${QUICK_ROLL_LAUNCHER_ID}[data-b20-qr-color="blue"], #${QUICK_ROLL_PANEL_ID}[data-b20-qr-color="blue"] {
    --b20-qr-accent: #6fb3e8; --b20-qr-accent-soft: rgba(111, 179, 232, 0.16); --b20-qr-label: #8cc6f2;
    --b20-qr-accent-bright: #9dcef4;
}
#${QUICK_ROLL_LAUNCHER_ID}[data-b20-qr-color="purple"], #${QUICK_ROLL_PANEL_ID}[data-b20-qr-color="purple"] {
    --b20-qr-accent: #b08ce8; --b20-qr-accent-soft: rgba(176, 140, 232, 0.16); --b20-qr-label: #c3a6f0;
    --b20-qr-accent-bright: #d1baf5;
}
#${QUICK_ROLL_LAUNCHER_ID}[data-b20-qr-color="amber"], #${QUICK_ROLL_PANEL_ID}[data-b20-qr-color="amber"] {
    --b20-qr-accent: #e0b45c; --b20-qr-accent-soft: rgba(224, 180, 92, 0.16); --b20-qr-label: #eac87f;
    --b20-qr-accent-bright: #efcc88;
}
#${QUICK_ROLL_LAUNCHER_ID}[data-b20-qr-color="rose"], #${QUICK_ROLL_PANEL_ID}[data-b20-qr-color="rose"] {
    --b20-qr-accent: #e88a9a; --b20-qr-accent-soft: rgba(232, 138, 154, 0.16); --b20-qr-label: #f0a5b2;
    --b20-qr-accent-bright: #f5b8c2;
}
#${QUICK_ROLL_LAUNCHER_ID}[data-b20-qr-theme="light"][data-b20-qr-color="green"], #${QUICK_ROLL_PANEL_ID}[data-b20-qr-theme="light"][data-b20-qr-color="green"] {
    --b20-qr-accent: #4e7a25; --b20-qr-accent-soft: rgba(78, 122, 37, 0.14); --b20-qr-label: #3d6318;
    --b20-qr-accent-bright: #395c17;
}
#${QUICK_ROLL_LAUNCHER_ID}[data-b20-qr-theme="light"][data-b20-qr-color="blue"], #${QUICK_ROLL_PANEL_ID}[data-b20-qr-theme="light"][data-b20-qr-color="blue"] {
    --b20-qr-accent: #1f6ea8; --b20-qr-accent-soft: rgba(31, 110, 168, 0.14); --b20-qr-label: #16578a;
    --b20-qr-accent-bright: #145788;
}
#${QUICK_ROLL_LAUNCHER_ID}[data-b20-qr-theme="light"][data-b20-qr-color="purple"], #${QUICK_ROLL_PANEL_ID}[data-b20-qr-theme="light"][data-b20-qr-color="purple"] {
    --b20-qr-accent: #6b3fa8; --b20-qr-accent-soft: rgba(107, 63, 168, 0.14); --b20-qr-label: #56318a;
    --b20-qr-accent-bright: #562e8e;
}
#${QUICK_ROLL_LAUNCHER_ID}[data-b20-qr-theme="light"][data-b20-qr-color="amber"], #${QUICK_ROLL_PANEL_ID}[data-b20-qr-theme="light"][data-b20-qr-color="amber"] {
    --b20-qr-accent: #96631a; --b20-qr-accent-soft: rgba(150, 99, 26, 0.14); --b20-qr-label: #7d5213;
    --b20-qr-accent-bright: #754b10;
}
#${QUICK_ROLL_LAUNCHER_ID}[data-b20-qr-theme="light"][data-b20-qr-color="rose"], #${QUICK_ROLL_PANEL_ID}[data-b20-qr-theme="light"][data-b20-qr-color="rose"] {
    --b20-qr-accent: #a83a52; --b20-qr-accent-soft: rgba(168, 58, 82, 0.14); --b20-qr-label: #8d2c41;
    --b20-qr-accent-bright: #8d293f;
}

@media (prefers-reduced-motion: reduce) {
    #${QUICK_ROLL_LAUNCHER_ID}, #${QUICK_ROLL_PANEL_ID}, .beyond20-qr-status,
    .beyond20-qr-row, .beyond20-qr-tabs button, .beyond20-qr-picker button,
    .beyond20-qr-picker img, .beyond20-qr-notice button, .beyond20-qr-header > button,
    .beyond20-qr-char-menu button {
        transition: none;
    }
    #${QUICK_ROLL_LAUNCHER_ID}:hover { transform: none; }
    #${QUICK_ROLL_LAUNCHER_ID}.beyond20-qr-busy img { animation: none; opacity: 0.55; }
}
`;

const QUICK_ROLL_STYLE_ID = "beyond20-quick-roll-style";

function injectQuickRollCSS() {
    if (document.getElementById(QUICK_ROLL_STYLE_ID))
        return;
    const style = document.createElement("style");
    style.id = QUICK_ROLL_STYLE_ID;
    style.textContent = QUICK_ROLL_CSS;
    (document.head || document.documentElement).appendChild(style);
}

// Apply the theme and text colour from the Roll20-tab popup options. Both roots carry
// the attributes, so the launcher's ring stays in step with the panel it opens.
function applyQuickRollAppearance() {
    const theme = (settings && settings["roll20-quick-roll-theme"]) || "dark";
    const color = (settings && settings["roll20-quick-roll-color"]) || "default";

    for (const id of [QUICK_ROLL_LAUNCHER_ID, QUICK_ROLL_PANEL_ID]) {
        const el = document.getElementById(id);
        if (!el) continue;
        el.dataset.b20QrTheme = theme;
        el.dataset.b20QrColor = color;
    }
}

function quickRollIconURL() {
    return chrome.runtime.getURL("images/icons/icon32.png");
}

function makeAvatar(url, className) {
    const img = E.img({ class: className || "", src: url || quickRollIconURL() });
    // The portrait is a cross-origin CDN URL Roll20's CSP may block; fall back to the
    // extension icon rather than a broken image.
    img.onerror = () => {
        img.onerror = null;
        img.src = quickRollIconURL();
    };
    return img;
}

// Every button in the launcher and panel, so they share one treatment: type="button",
// and a click that does not reach Roll20's own handlers. `content` is a string, a node,
// or an array of both.
function makeButton(content, onClick, className, title) {
    const button = document.createElement("button");
    button.type = "button";
    if (className) button.className = className;
    if (title) button.title = title;
    button.append(...(Array.isArray(content) ? content : [content]));
    button.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        onClick(ev);
    });
    return button;
}

// A message in place of the rolls; `content` takes makeButton's shapes.
function makeNotice(...content) {
    return E.div({ class: "beyond20-qr-notice" }, ...content);
}

function quickRollRetryButton() {
    return makeButton("Retry", () => loadQuickRollData());
}

function quickRollRow(rollType, name, label, modifier) {
    return { rollType, name, label: label || name, modifier: modifier || "" };
}

// The rolls for a section, as blocks of rows. Skills keep their parent ability as a
// block label; saves and checks are one unlabelled block, since there the ability *is*
// the row.
function quickRollSectionBlocks(section) {
    const data = quick_roll_data;
    if (!data) return [];

    if (section !== "skills") {
        const rows = section === "saves"
            ? (data.saves || []).map((s) => quickRollRow("saving-throw", s.abbr, s.name, s.modifier))
            : (data.abilities || []).map((a) => quickRollRow("ability", a.abbr, a.name, a.modifier));
        return [{ rows: rows }];
    }

    // A custom skill has no parent ability, and rolling one would ask which to use — a
    // question a hidden tab cannot put to the player, so those are left out rather than
    // offered and refused.
    const skills = (data.skills || []).filter((s) => QUICK_ROLL_ABILITY_ORDER.includes(s.ability));
    return QUICK_ROLL_ABILITY_ORDER
        .map((ability) => ({
            group: ability,
            rows: skills.filter((s) => s.ability === ability)
                .map((s) => quickRollRow("skill", s.name, s.name, s.modifier))
        }))
        .filter((block) => block.rows.length > 0);
}

// True once the D&D Beyond sheet has reported anything to roll. A sheet found but not
// read yet answers with empty lists rather than failing, so this distinguishes "still
// loading" from "nothing to offer".
function quickRollDataReady() {
    if (!quick_roll_data) return false;
    return (quick_roll_data.abilities || []).length > 0 ||
        (quick_roll_data.saves || []).length > 0 ||
        (quick_roll_data.skills || []).length > 0;
}

function makeQuickRollRow(row) {
    const label = E.span({}, row.label);
    const mod = E.span({ class: "beyond20-qr-mod" }, row.modifier);
    return makeButton([label, mod],
        () => performQuickRollFromPanel(row.rollType, row.name),
        "beyond20-qr-row", "Roll " + row.label);
}

// The rolls: one column of rows for saves and checks, and for skills a group per
// ability, named down the left.
function renderQuickRollRows(body) {
    const blocks = quickRollSectionBlocks(body.dataset.beyond20Section || "skills");
    if (blocks.length === 0)
        return body.appendChild(makeNotice("Nothing to roll in this section."));

    for (const block of blocks) {
        const items = E.div({ class: "beyond20-qr-items" },
            ...block.rows.map(makeQuickRollRow));

        if (!block.group) {
            body.appendChild(items);
            continue;
        }
        body.appendChild(E.div({ class: "beyond20-qr-group" },
            E.div({ class: "beyond20-qr-group-label" }, block.group), items));
    }
}

// One entry in the open-sheet list, shared by the picker and the header menu so the two
// cannot drift apart.
function makeQuickRollCharacterButton(character) {
    const label = E.span({}, character.name || "unnamed");
    const button = makeButton([makeAvatar(character.avatar), label],
        () => useQuickRollCharacter(character));
    if (quickRollActiveCharacterId() === String(character.id))
        button.classList.add("beyond20-qr-active");
    return button;
}

// Every sheet that answered, shown body-wide when it is unclear which one the player is
// playing. Each entry carries its own roll lists, so picking is instant.
function renderQuickRollPicker(body) {
    body.appendChild(E.div({ class: "beyond20-qr-picker" },
        ...quick_roll_characters.map(makeQuickRollCharacterButton)));
    renderQuickRollStatus("Which character are you playing?");
}

function renderQuickRollBody() {
    const body = document.querySelector("#" + QUICK_ROLL_PANEL_ID + " .beyond20-qr-body");
    if (!body) return;

    body.textContent = "";

    if (quick_roll_picker_open)
        return renderQuickRollPicker(body);

    if (!quick_roll_data)
        return body.appendChild(makeNotice(
            "Couldn't read your D&D Beyond character sheet. Open it on dndbeyond.com, then retry.",
            quickRollRetryButton()));

    if (!quickRollDataReady())
        return body.appendChild(makeNotice(
            "Your D&D Beyond character sheet is still loading. Open its tab and wait a moment, then retry.",
            quickRollRetryButton()));

    renderQuickRollRows(body);
}

function renderQuickRollStatus(message) {
    const status = document.querySelector("#" + QUICK_ROLL_PANEL_ID + " .beyond20-qr-status");
    if (status) status.textContent = message || "";
}

function setQuickRollTabsVisible(visible) {
    const tabs = document.querySelector("#" + QUICK_ROLL_PANEL_ID + " .beyond20-qr-tabs");
    if (tabs) tabs.hidden = !visible;
    const panel = document.getElementById(QUICK_ROLL_PANEL_ID);
    if (panel) panel.classList.toggle("beyond20-qr-has-tabs", visible);
}

function buildQuickRollPanel() {
    // The panel hides through .beyond20-qr-open, toggled by open/closeQuickRollPanel;
    // there is no hidden attribute to set here.
    const panel = E.div({ id: QUICK_ROLL_PANEL_ID, tabindex: "-1" });

    const header = E.div({ class: "beyond20-qr-header" });
    const portrait = makeAvatar(null, "beyond20-qr-portrait");
    const name = E.span({ class: "beyond20-qr-name" });
    const switchCharacter = makeButton("⇄", () => toggleQuickRollCharacterMenu(), "beyond20-qr-switch");
    switchCharacter.hidden = true;
    const refresh = makeButton("↻", () => loadQuickRollData(), "beyond20-qr-refresh", "Refresh");
    const close = makeButton("✕", () => closeQuickRollPanel(), "beyond20-qr-close", "Close");
    header.append(portrait, name, switchCharacter, refresh, close);

    // Inside the header, so it hangs off the bottom edge without anything knowing how
    // tall the header is.
    const characterMenu = E.div({ class: "beyond20-qr-char-menu" });
    characterMenu.hidden = true;
    header.appendChild(characterMenu);

    const body = E.div({ class: "beyond20-qr-body" });
    body.dataset.beyond20Section = "skills";

    const status = E.div({ class: "beyond20-qr-status" });

    const tabs = E.div({ class: "beyond20-qr-tabs" });
    for (const [key, label] of [["skills", "Skills"], ["saves", "Saves"], ["checks", "Checks"]]) {
        const button = makeButton(label, () => selectQuickRollSection(key));
        button.dataset.beyond20Section = key;
        tabs.appendChild(button);
    }

    // Tabs go last on purpose: the panel is bottom-anchored, so whatever is last stays
    // put while the content above changes height.
    panel.append(header, body, status, tabs);
    return panel;
}

function selectQuickRollSection(section) {
    const panel = document.getElementById(QUICK_ROLL_PANEL_ID);
    if (!panel) return;

    const body = panel.querySelector(".beyond20-qr-body");
    if (body) body.dataset.beyond20Section = section;

    panel.querySelectorAll(".beyond20-qr-tabs button").forEach((button) => {
        button.classList.toggle("beyond20-qr-active", button.dataset.beyond20Section === section);
    });

    // Reached from a tab click, itself a way out of the character picker.
    quick_roll_picker_open = false;
    renderQuickRollBody();
}

function renderQuickRollHeader() {
    const panel = document.getElementById(QUICK_ROLL_PANEL_ID);
    if (!panel || !quick_roll_data) return;

    // Compares the attribute, not .src, which the browser resolves to an absolute URL;
    // re-setting it would restart the image load on every render.
    const portrait = panel.querySelector(".beyond20-qr-portrait");
    const wanted = quick_roll_data.avatar || quickRollIconURL();
    if (portrait && portrait.getAttribute("src") !== wanted)
        portrait.src = wanted;

    const name = panel.querySelector(".beyond20-qr-name");
    if (name) name.textContent = quick_roll_data.name || "D&D Beyond";
}

function quickRollActiveCharacterId() {
    return (quick_roll_data && String(quick_roll_data.id)) || "";
}

// The switch button earns its place only when another sheet is available, and is noise
// while the full-panel picker already asks the same question.
function updateQuickRollSwitchButton() {
    const button = quickRollSwitchButton();
    if (!button) return;
    const count = quick_roll_characters.length;
    button.hidden = quick_roll_picker_open || count < 2;
    button.title = count > 1 ? "Switch character (" + count + " sheets open)" : "";
}

// Switch to a character the panel already holds: no round trip and no re-render of the
// frame, so the rolls change under the same tabs.
function useQuickRollCharacter(character) {
    if (!character) return;
    rememberQuickRollCharacter(character.id, character.name);
    closeQuickRollCharacterMenu();
    quick_roll_picker_open = false;
    renderQuickRollState({ state: "ready", character: character });
}

function quickRollCharacterMenu() {
    return document.querySelector("#" + QUICK_ROLL_PANEL_ID + " .beyond20-qr-char-menu");
}

function quickRollSwitchButton() {
    return document.querySelector("#" + QUICK_ROLL_PANEL_ID + " .beyond20-qr-switch");
}

function closeQuickRollCharacterMenu() {
    const menu = quickRollCharacterMenu();
    if (menu) menu.hidden = true;
    const button = quickRollSwitchButton();
    if (button) button.classList.remove("beyond20-qr-active");
}

function toggleQuickRollCharacterMenu() {
    const menu = quickRollCharacterMenu();
    if (!menu) return;
    if (!menu.hidden)
        return closeQuickRollCharacterMenu();
    if (quick_roll_characters.length < 2)
        return;

    menu.replaceChildren(...quick_roll_characters.map(makeQuickRollCharacterButton));
    menu.hidden = false;

    const button = quickRollSwitchButton();
    if (button) button.classList.add("beyond20-qr-active");
}

// Show whichever of the four states the current responder set implies.
function renderQuickRollState(result) {
    const panel = document.getElementById(QUICK_ROLL_PANEL_ID);
    if (!panel) return;

    const body = panel.querySelector(".beyond20-qr-body");
    if (!body) return;

    body.textContent = "";
    // The menu lists the sheets that answered; this is a fresh answer.
    closeQuickRollCharacterMenu();

    quick_roll_data = result.state === "ready" ? result.character : null;
    quick_roll_picker_open = result.state === "picker";
    setQuickRollTabsVisible(result.state === "ready");
    updateQuickRollSwitchButton();
    renderQuickRollStatus("");

    if (result.state === "ready") {
        renderQuickRollHeader();
        return renderQuickRollBody();
    }

    if (result.state === "picker")
        return renderQuickRollBody();

    if (result.state === "none") {
        return body.appendChild(makeNotice(
            "No D&D Beyond character sheet is open. Open your character on dndbeyond.com, then retry.",
            quickRollRetryButton()));
    }

    // stale: the remembered sheet is not among the responders.
    const who = result.remembered.name || "your character";
    const names = result.characters.map((c) => c.name || "unnamed").join(", ");
    const use = result.characters[0];
    body.appendChild(makeNotice(
        "You're playing " + who + ", but that sheet isn't open. Open sheets: " + names + ".",
        makeButton("Use " + (use.name || "this sheet") + " instead", () => useQuickRollCharacter(use)),
        quickRollRetryButton()));
}

// Stop a press pulling focus out of Roll20's chat box. Only button presses are affected,
// so the scrollbar can still be dragged and the click still fires.
function suppressFocusStealing(el) {
    el.addEventListener("mousedown", (ev) => {
        if (ev.target.closest && ev.target.closest("button"))
            ev.preventDefault();
    });
}

function closeQuickRollPanel() {
    const panel = document.getElementById(QUICK_ROLL_PANEL_ID);
    if (panel) panel.classList.remove("beyond20-qr-open");
    closeQuickRollCharacterMenu();
    quick_roll_panel_open = false;
    window.removeEventListener("keydown", onQuickRollKeyDown, true);
    document.removeEventListener("mousedown", onQuickRollClickOutside, true);
}

function onQuickRollKeyDown(event) {
    if (event.key !== "Escape" || !quick_roll_panel_open)
        return;
    // Swallow the key only when we handle it, so Roll20's own Esc handling is untouched
    // while the panel is closed.
    event.preventDefault();
    event.stopPropagation();

    // Esc backs out one step at a time: the menu, then the panel.
    const menu = quickRollCharacterMenu();
    if (menu && !menu.hidden)
        return closeQuickRollCharacterMenu();

    closeQuickRollPanel();
}

function onQuickRollClickOutside(event) {
    const panel = document.getElementById(QUICK_ROLL_PANEL_ID);
    const launcher = document.getElementById(QUICK_ROLL_LAUNCHER_ID);
    if (panel && panel.contains(event.target)) return;
    if (launcher && launcher.contains(event.target)) return;
    closeQuickRollPanel();
}

function openQuickRollPanel() {
    const panel = document.getElementById(QUICK_ROLL_PANEL_ID);
    if (!panel) return;

    // Added before the render below, so the panel animates in carrying its content
    // rather than flashing empty and filling a frame later.
    panel.classList.add("beyond20-qr-open");
    quick_roll_panel_open = true;

    selectQuickRollSection(panel.querySelector(".beyond20-qr-body")?.dataset.beyond20Section || "skills");

    // Reading the sheet is cheap, so a panel with nothing to show asks again rather than
    // sending the player to the refresh button. Data in hand is left alone.
    if (!quickRollDataReady())
        loadQuickRollData();

    // Registered only while open, and without focusing anything: players keep typing in
    // Roll20's chat while using the panel.
    window.addEventListener("keydown", onQuickRollKeyDown, true);
    document.addEventListener("mousedown", onQuickRollClickOutside, true);
}

function toggleQuickRollPanel() {
    if (quick_roll_panel_open) closeQuickRollPanel();
    else openQuickRollPanel();
}

function loadQuickRollData() {
    renderQuickRollStatus("Reading your D&D Beyond character…");

    const request_id = ++quick_roll_request_id;
    requestQuickRollData((response) => {
        // A newer request has been made since; its answer is the one that counts.
        if (request_id !== quick_roll_request_id)
            return;

        if (!response) {
            renderQuickRollState({ state: "none" });
            return;
        }

        getRememberedQuickRollCharacter((remembered) => {
            if (request_id !== quick_roll_request_id)
                return;

            // Kept so the panel can switch between sheets without asking again; each
            // responder brings its own roll lists.
            quick_roll_characters = response.characters || [];
            const result = selectQuickRollCharacter(quick_roll_characters, remembered);

            // An unambiguous character is remembered, so later loads go straight to ready.
            if (result.state === "ready" && (!remembered || String(remembered.id) !== String(result.character.id)))
                rememberQuickRollCharacter(result.character.id, result.character.name);

            renderQuickRollState(result);
        });
    });
}

function performQuickRollFromPanel(rollType, name) {
    closeQuickRollCharacterMenu();
    const launcher = document.getElementById(QUICK_ROLL_LAUNCHER_ID);
    if (launcher) launcher.classList.add("beyond20-qr-busy");
    renderQuickRollStatus("Rolling…");

    sendQuickRoll(rollType, name, (response) => {
        if (launcher) launcher.classList.remove("beyond20-qr-busy");
        renderQuickRollStatus(quickRollResultMessage(response));
    });
}

// The roll reports into the Roll20 chat, so success needs no message here; only the
// cases the player must act on are worth saying.
function quickRollResultMessage(response) {
    if (response && response.ok)
        return "";

    const reason = (response && response.reason) || "no-tab";
    if (["interactive-setting", "custom-skill"].includes(reason))
        return "This roll needs a choice. Open your D&D Beyond tab to roll it.";
    if (reason === "disconnected")
        return "Beyond20 was reloaded. Reload this page to continue.";
    if (reason === "busy")
        return "Another roll is still in progress.";
    if (reason === "pane-timeout" || reason === "not-found")
        return "Couldn't find that on your D&D Beyond sheet. Try refreshing the panel.";

    return "No D&D Beyond character sheet is open.";
}

function removeQuickRollUI() {
    closeQuickRollPanel();
    for (const id of [QUICK_ROLL_LAUNCHER_ID, QUICK_ROLL_PANEL_ID])
        document.getElementById(id)?.remove();
}

function injectQuickRollLauncher() {
    // Never inject into the Roll20 Discord-activity iframe.
    if (window.top !== window) return;
    if (typeof settings === "undefined" || !settings["roll20-quick-roll-panel"]) {
        removeQuickRollUI();
        return;
    }
    if (!document.body) return;

    // Called on startup, on settings changes and on Roll20 re-renders, so the launcher
    // is usually already there and there is nothing to do.
    if (document.getElementById(QUICK_ROLL_LAUNCHER_ID))
        return;

    // Clearing first also drops the panel's open state and listeners, which would
    // otherwise outlive the panel.
    removeQuickRollUI();
    injectQuickRollCSS();

    const launcher = makeButton(makeAvatar(null), () => toggleQuickRollPanel(), null, "Beyond20 quick rolls");
    launcher.id = QUICK_ROLL_LAUNCHER_ID;

    const panel = buildQuickRollPanel();
    suppressFocusStealing(launcher);
    suppressFocusStealing(panel);

    // Appended to <body>, not Roll20's chat container, so a chat re-render cannot
    // remove it.
    document.body.appendChild(launcher);
    document.body.appendChild(panel);

    applyQuickRollAppearance();
    loadQuickRollData();
}
