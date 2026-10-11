/*from src/dndbeyond/base/utils.js import skillToAbility, abbreviationToAbility, normalizeAbilityName;
  from src/dndbeyond/base/dice.js import b20_remote_roll_context;
  from src/dndbeyond/content-scripts/character.js import scrapeAbilityRow, scrapeSavingThrowRow,
      quickRollAbilityRow, quickRollSaveRow, getOpenSkillPaneClass, getSkillPaneName, execute,
      resetHijackQuickRollState, rollInitiative, character;
  from src/dndbeyond/base/utils.js import propertyListToDict, button_class_small;*/

// Remote quick rolls: rolls driven from the Roll20 side (see src/roll20/quick-roll.js),
// so a player can roll a skill, save, ability check, initiative or a favourite attack or
// spell without leaving the Roll20 tab, and change the character's hit points. It also
// owns the favourite stars and the side pane's Favorite button.
// The roll always happens here, on the real sheet, so all of Beyond20's scraping and
// class-feature handling applies as if the player had clicked the sheet.
//
// This tab is normally in the background, so anything that would block on a visible
// prompt is refused rather than awaited. See b20_remote_roll_context in
// src/dndbeyond/base/dice.js.

const QUICK_ROLL_ABILITY_ROW_SELECTOR =
    ".ddbc-ability-summary, .ct-ability-summary";
const QUICK_ROLL_SAVE_ROW_SELECTOR =
    ".ct-saving-throws-summary__ability, .ddbc-saving-throws-summary__ability";
const QUICK_ROLL_SKILL_ROW_SELECTOR =
    ".ct-skills .ct-skills__list .ct-skills__item, .ddbc-skills .ddbc-skills__list .ddbc-skills__item";
const QUICK_ROLL_SKILL_NAME_SELECTOR =
    ".ct-skills__col--skill, .ddbc-skills__col--skill";
const QUICK_ROLL_SKILL_MODIFIER_SELECTOR =
    ".ct-skills__col--modifier, .ddbc-skills__col--modifier";
const QUICK_ROLL_INITIATIVE_VALUE_SELECTOR =
    ".ct-combat__summary-group--initiative span[class*='styles_numberDisplay'], " +
    ".ct-combat-tablet__extra--initiative span[class*='styles_numberDisplay'], " +
    ".ct-combat-mobile__extras > section[class*='styles_boxMobile'] span[class*='styles_numberDisplay']";

// Coarse upper bound on waiting for a side pane or tab to render; the wait itself is driven by
// a MutationObserver, because timers are throttled in background tabs.
const QUICK_ROLL_PANE_TIMEOUT_MS = 8000;

function scrapeSkillRow(row) {
    const $row = $(row);
    const name = $row.find(QUICK_ROLL_SKILL_NAME_SELECTOR).first().text().trim();
    const modifier = $row.find(QUICK_ROLL_SKILL_MODIFIER_SELECTOR).first().text().replace(/\s+/g, "");
    return { name, ability: skillToAbility(name), modifier };
}

function getQuickRollAbilities() {
    // Already in memory from Character.updateInfo(); no DOM query needed.
    return (character._abilities || []).map(([name, abbr, score, modifier]) => ({ name, abbr, modifier }));
}

function getQuickRollSaves() {
    const saves = [];
    $(QUICK_ROLL_SAVE_ROW_SELECTOR).each((_, row) => {
        const save = scrapeSavingThrowRow(row);
        if (save && save.ability)
            saves.push({ name: save.ability_name, abbr: save.ability, modifier: save.modifier });
    });
    return saves;
}

function getQuickRollSkills() {
    const skills = [];
    $(QUICK_ROLL_SKILL_ROW_SELECTOR).each((_, row) => {
        const skill = scrapeSkillRow(row);
        if (skill && skill.name)
            skills.push(skill);
    });
    return skills;
}

// The same value rollInitiative reads, so what the panel shows is what gets rolled.
function getQuickRollInitiative() {
    const modifier = $(QUICK_ROLL_INITIATIVE_VALUE_SELECTOR).first().text().replace(/\s+/g, "");
    return modifier ? { modifier } : null;
}

function getQuickRollData() {
    if (!character._id)
        return null;

    return {
        // A string: the Roll20 side compares it against ids learned from roll messages.
        id: String(character._id),
        name: character._name || "",
        avatar: character._avatar || null,
        abilities: getQuickRollAbilities(),
        saves: getQuickRollSaves(),
        skills: getQuickRollSkills(),
        initiative: getQuickRollInitiative(),
        hp: getQuickRollHp(),
        favorites: loadQuickRollFavorites(character._id)
    };
}

// --- Favourites ------------------------------------------------------------ *
// The player's pick of attacks, actions and spells, pinned to the launcher's first tab.
// Starred from a star after the name in the sheet's attack and spell rows, or from the
// Favorite button under "Display in VTT" in the side pane. Kept in this site's
// localStorage, per character, in the order they were starred.
//
// Each favourite carries its own label and to-hit: the launcher asks for them while the
// sheet may be showing another tab, and then the row is not on the page to read.

const QUICK_ROLL_FAVORITES_STORAGE_KEY = "beyond20-quick-roll-favorites";
const QUICK_ROLL_ATTACK_ROW_SELECTOR = ".ct-combat-attack, .ddbc-combat-attack";
const QUICK_ROLL_ATTACK_LABEL_SELECTOR =
    ".ct-combat-attack__name .ct-combat-attack__label, .ddbc-combat-attack__name .ddbc-combat-attack__label";
const QUICK_ROLL_ATTACK_TOHIT_SELECTOR = ".ct-combat-attack__tohit, .ddbc-combat-attack__tohit";
const QUICK_ROLL_SPELL_ROW_SELECTOR = ".ct-spells-spell, .ddbc-spells-spell";
const QUICK_ROLL_SPELL_NAME_SELECTOR = ".ct-spell-name, .ddbc-spell-name, span[class*='styles_spellName']";
const QUICK_ROLL_SPELL_TOHIT_SELECTOR = ".ct-spells-spell__tohit, .ddbc-spells-spell__tohit";
const QUICK_ROLL_ITEM_NAME_SELECTOR = ".ct-item-name, .ddbc-item-name, span[class*='styles_itemName']";
// Every pane an attack row can open: a spell listed among the attacks opens the spell's.
const QUICK_ROLL_ACTION_PANES = ["b20-item-pane", "b20-action-pane", "ct-custom-action-pane", "b20-custom-action-pane", "ct-spell-pane"];

// A name as the sheet shows it, less the "*" it puts after a customised item, which the
// item's own pane leaves off.
function normalizeQuickRollName(text) {
    return String(text || "").replace(/\s+/g, " ").trim().replace(/\s*\*$/, "");
}

// A spell's name without the ritual and concentration markers nested after it.
function quickRollSpellName(element) {
    if (!element) return "";
    const first = element.firstChild;
    return normalizeQuickRollName(first && first.nodeType === Node.TEXT_NODE ? first.textContent : element.textContent);
}

// "+10", "DC 15": compact enough for the launcher's modifier pill.
function quickRollDetail(text) {
    const detail = String(text || "").replace(/\s+/g, " ").replace(/([+-]) /g, "$1").trim();
    return detail === "--" ? "" : detail.slice(0, 12);
}

// The heading a spell row sits under ("Cantrip", "1st Level"), which the spell pane's
// casting level is compared against.
function quickRollSpellRowLevel(row) {
    return $(row).closest(".ct-content-group").find(".ct-content-group__header-content").first().text().trim();
}

function quickRollSpellPaneLevel() {
    const castas = $(".ct-spell-caster__casting-level-current").text().trim();
    return castas === "" ? "Cantrip" : `${castas} Level`;
}

function quickRollSpellLabel(name, level) {
    return level && level.toLowerCase() !== "cantrip" ? `${name} (${level.replace(/ Level$/i, "")})` : name;
}

function quickRollFavoriteKey(fav) {
    return fav.rollType + ":" + fav.name.toLowerCase() + (fav.level ? ":" + fav.level.toLowerCase() : "");
}

// Storage is written by this page only, but checked anyway: a bad entry would otherwise
// travel to the launcher and become a roll request.
function isValidQuickRollFavorite(fav) {
    return !!fav && typeof fav === "object" &&
        ["action", "spell"].includes(fav.rollType) &&
        typeof fav.name === "string" && fav.name.length > 0 && fav.name.length < 100 &&
        (fav.rollType !== "spell" || (typeof fav.level === "string" && fav.level.length > 0 && fav.level.length < 40));
}

// Storage can be unavailable (blocked site data) or hold something unexpected; either
// way the sheet carries on with no favourites rather than failing.
function readQuickRollFavoritesStore() {
    try {
        const store = JSON.parse(localStorage.getItem(QUICK_ROLL_FAVORITES_STORAGE_KEY) || "{}");
        return store && typeof store === "object" && !Array.isArray(store) ? store : {};
    } catch (err) {
        return {};
    }
}

function loadQuickRollFavorites(characterId) {
    const list = readQuickRollFavoritesStore()[String(characterId)];
    return Array.isArray(list) ? list.filter(isValidQuickRollFavorite) : [];
}

function saveQuickRollFavorites(characterId, favorites) {
    const store = readQuickRollFavoritesStore();
    if (favorites.length > 0)
        store[String(characterId)] = favorites;
    else
        delete store[String(characterId)];
    try {
        localStorage.setItem(QUICK_ROLL_FAVORITES_STORAGE_KEY, JSON.stringify(store));
    } catch (err) {
        console.warn("Beyond20: couldn't save quick roll favourites", err);
    }
}

// Adds the favourite if missing, removes it if present.
function toggleQuickRollFavorite(characterId, fav) {
    const favorites = loadQuickRollFavorites(characterId);
    const key = quickRollFavoriteKey(fav);
    const index = favorites.findIndex((f) => quickRollFavoriteKey(f) === key);
    if (index === -1)
        favorites.push(fav);
    else
        favorites.splice(index, 1);
    saveQuickRollFavorites(characterId, favorites);
}

function quickRollAttackRowFavorite(row) {
    const name = normalizeQuickRollName($(row).find(QUICK_ROLL_ATTACK_LABEL_SELECTOR).first().text());
    if (!name) return null;
    return { rollType: "action", name, label: name, detail: quickRollDetail($(row).find(QUICK_ROLL_ATTACK_TOHIT_SELECTOR).first().text()) };
}

function quickRollSpellRowFavorite(row) {
    const name = quickRollSpellName($(row).find(QUICK_ROLL_SPELL_NAME_SELECTOR)[0]);
    const level = quickRollSpellRowLevel(row);
    if (!name || !level) return null;
    return {
        rollType: "spell", name, level,
        label: quickRollSpellLabel(name, level),
        detail: quickRollDetail($(row).find(QUICK_ROLL_SPELL_TOHIT_SELECTOR).first().text())
    };
}

function findAttackRow(name) {
    const wanted = name.toLowerCase();
    return $(QUICK_ROLL_ATTACK_ROW_SELECTOR).toArray().find((row) => {
        const fav = quickRollAttackRowFavorite(row);
        return fav && fav.name.toLowerCase() === wanted;
    }) || null;
}

function findSpellRow(name, level) {
    const wanted = quickRollFavoriteKey({ rollType: "spell", name, level });
    return $(QUICK_ROLL_SPELL_ROW_SELECTOR).toArray().find((row) => {
        const fav = quickRollSpellRowFavorite(row);
        return fav && quickRollFavoriteKey(fav) === wanted;
    }) || null;
}

// The open side pane's name, for whichever of the action panes it is.
function quickRollActionPaneName(paneClass) {
    const heading = $("." + paneClass + " .ct-sidebar__heading").first();
    if (paneClass === "ct-spell-pane")
        return quickRollSpellName(heading.find(QUICK_ROLL_SPELL_NAME_SELECTOR)[0]);
    const item = paneClass === "b20-item-pane" ? heading.find(QUICK_ROLL_ITEM_NAME_SELECTOR).first() : $();
    return normalizeQuickRollName(item.length ? item.text() : heading.text());
}

// The favourite the open side pane stands for, if it is one the launcher can roll: a
// spell, or an action or weapon with a row among the attacks to roll it from.
function quickRollPaneFavorite() {
    if ($(".ct-spell-pane").length) {
        const name = quickRollActionPaneName("ct-spell-pane");
        const level = quickRollSpellPaneLevel();
        if (!name) return null;
        const row = findSpellRow(name, level);
        return row ? quickRollSpellRowFavorite(row) :
            { rollType: "spell", name, level, label: quickRollSpellLabel(name, level), detail: "" };
    }
    for (const paneClass of ["b20-item-pane", "b20-action-pane", "ct-custom-action-pane", "b20-custom-action-pane"]) {
        if (!$("." + paneClass).length) continue;
        const name = quickRollActionPaneName(paneClass);
        const row = name ? findAttackRow(name) : null;
        return row ? quickRollAttackRowFavorite(row) : null;
    }
    return null;
}

// Where stars go: after the name in each attack and spell row.
const QUICK_ROLL_FAVORITE_TARGETS = [
    { rollType: "action", row: QUICK_ROLL_ATTACK_ROW_SELECTOR, host: QUICK_ROLL_ATTACK_LABEL_SELECTOR, scrape: quickRollAttackRowFavorite },
    { rollType: "spell", row: QUICK_ROLL_SPELL_ROW_SELECTOR, host: QUICK_ROLL_SPELL_NAME_SELECTOR, scrape: quickRollSpellRowFavorite }
];

// Stopped at the button so the press never reaches the sheet's own handlers, which would
// open the row's side pane or roll it.
function isolateQuickRollPress(button) {
    for (const type of ["mousedown", "pointerdown", "mouseup", "pointerup"])
        button.addEventListener(type, (ev) => ev.stopPropagation());
}

function onQuickRollFavoriteClick(ev, getFavorite) {
    ev.preventDefault();
    ev.stopPropagation();
    const fav = getFavorite();
    if (!fav || !character._id) return;
    toggleQuickRollFavorite(character._id, fav);
    updateQuickRollFavorites();
}

function makeQuickRollFavoriteStar(target) {
    // The glyph comes from CSS rather than text, so the name it sits in reads the same to
    // every scraper.
    const star = document.createElement("button");
    star.type = "button";
    star.className = "beyond20-qr-fav";
    isolateQuickRollPress(star);
    star.addEventListener("click", (ev) => onQuickRollFavoriteClick(ev, () => {
        const row = star.closest(target.row);
        return row ? target.scrape(row) : null;
    }));
    return star;
}

function quickRollFavoriteTitle(on) {
    return on ? "Remove from Beyond20 quick roll favourites" : "Add to Beyond20 quick roll favourites";
}

function setQuickRollFavoriteStarState(star, on) {
    // Only written on a real change: this runs from the sheet's MutationObserver, and a
    // write on every pass would keep waking it.
    if (star.classList.contains("beyond20-qr-fav-on") !== on)
        star.classList.toggle("beyond20-qr-fav-on", on);
    const title = quickRollFavoriteTitle(on);
    if (star.title !== title) {
        star.title = title;
        star.setAttribute("aria-label", title);
    }
}

// The Favorite button under "Display in VTT" in the side pane, for whatever the pane shows.
function updateQuickRollFavoriteButton(keys) {
    const display = $(".ct-beyond20-roll-display").first();
    const fav = display.length ? quickRollPaneFavorite() : null;
    let holder = $(".ct-beyond20-favorite");
    if (!fav) {
        holder.remove();
        return;
    }

    if (holder.length === 0) {
        const button = E.button({ class: "ct-beyond20-favorite-button " + button_class_small.replace("filled", "outline") },
            E.span({ class: "ct-button__content" }));
        isolateQuickRollPress(button);
        button.addEventListener("click", (ev) => onQuickRollFavoriteClick(ev, quickRollPaneFavorite));
        holder = $(E.div({ class: "ct-beyond20-favorite" }, button));
    }
    // Kept right under "Display in VTT", which the sheet re-creates on every pane change.
    if (holder.prev()[0] !== display[0])
        display.after(holder);

    const on = keys.has(quickRollFavoriteKey(fav));
    const content = holder.find(".ct-button__content")[0];
    const text = (on ? "★ " : "☆ ") + "Favorite";
    if (content.textContent !== text) content.textContent = text;
    const button = holder.find("button")[0];
    if (button.classList.contains("beyond20-qr-fav-on") !== on) button.classList.toggle("beyond20-qr-fav-on", on);
    const title = quickRollFavoriteTitle(on);
    if (button.title !== title) button.title = title;
}

// Called on every sheet mutation: the sheet re-renders its rows often, dropping anything
// added to them, so a missing star is simply put back. Visible rows also refresh their
// favourite's stored label and to-hit, which change as the character does.
function updateQuickRollFavorites() {
    if (!settings["roll20-quick-roll-panel"] || !character._id) {
        $(".beyond20-qr-fav, .ct-beyond20-favorite").remove();
        return;
    }

    const favorites = loadQuickRollFavorites(character._id);
    const byKey = new Map(favorites.map((f) => [quickRollFavoriteKey(f), f]));
    let stale = false;

    for (const target of QUICK_ROLL_FAVORITE_TARGETS) {
        $(target.row).each((_, row) => {
            const fav = target.scrape(row);
            if (!fav) return;
            const host = $(row).find(target.host).first()[0];
            if (!host) return;

            let star = host.querySelector(":scope > .beyond20-qr-fav");
            if (!star) {
                row.classList.add("beyond20-qr-fav-row");
                star = makeQuickRollFavoriteStar(target);
                host.appendChild(star);
            }
            const stored = byKey.get(quickRollFavoriteKey(fav));
            setQuickRollFavoriteStarState(star, !!stored);
            if (stored && (stored.label !== fav.label || stored.detail !== fav.detail)) {
                Object.assign(stored, { label: fav.label, detail: fav.detail });
                stale = true;
            }
        });
    }
    if (stale)
        saveQuickRollFavorites(character._id, favorites);

    updateQuickRollFavoriteButton(new Set(byKey.keys()));
}

// Resolve a name from the launcher back to a live sheet row. Matching the scraped value
// rather than the raw text keeps the launcher and the roll in agreement.
function findRowByScrape(selector, scrape, wanted) {
    let found = null;
    $(selector).each((_, row) => {
        if (found) return;
        if (scrape(row) === wanted) found = row;
    });
    return found;
}

function findAbilityRow(ability) {
    return findRowByScrape(QUICK_ROLL_ABILITY_ROW_SELECTOR, (row) => scrapeAbilityRow(row).ability, ability);
}

function findSaveRow(ability) {
    return findRowByScrape(QUICK_ROLL_SAVE_ROW_SELECTOR, (row) => scrapeSavingThrowRow(row).ability, ability);
}

function findSkillRow(name) {
    return findRowByScrape(QUICK_ROLL_SKILL_ROW_SELECTOR, (row) => scrapeSkillRow(row).name, name);
}

// Resolves to what `ready` returns once it returns something, re-checked on every change
// to the sheet, or to null on timeout. `trigger` runs once, after the first check, to
// set off whatever is being waited for.
function waitForSheet(ready, trigger = null) {
    return new Promise((resolve) => {
        const already = ready();
        if (already) return resolve(already);

        let done = false;
        let observer = null;
        let timer = 0;

        const finish = (value) => {
            if (done) return;
            done = true;
            if (observer) observer.disconnect();
            if (timer) clearTimeout(timer);
            resolve(value);
        };

        // MutationObserver callbacks escape the background-tab timer throttling that
        // would stretch a setTimeout-based wait to about a minute. Class changes count
        // too: that is how Beyond20 marks the side pane it recognised.
        observer = new MutationObserver(() => {
            const value = ready();
            if (value) finish(value);
        });
        observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class"] });

        timer = setTimeout(() => finish(null), QUICK_ROLL_PANE_TIMEOUT_MS);

        if (trigger) trigger();
    });
}

// The pane for a skill, opened by clicking the skill row if needed. Resolves to the pane
// class, or null on timeout.
function openSkillPaneAndWait(label, skillName) {
    return waitForSheet(() => {
        const paneClass = getOpenSkillPaneClass();
        if (!paneClass || getSkillPaneName(paneClass) !== skillName) return null;
        // The header fills in before the rest of the pane and the roll reads the
        // modifier from it, so don't hand the pane over until it is there.
        if ($("." + paneClass + "__header-modifier").length === 0) return null;
        return paneClass;
    }, () => label.trigger("click"));
}

// Open the pane a skill roll needs, so the caller can report a failure to get there
// before committing to the roll.
async function prepareSkillRoll(skillName) {
    const row = findSkillRow(skillName);
    if (!row)
        return { ok: false, reason: "not-found" };

    // Clear the pending-roll state the sheet's own hover leaves behind: with it set, the
    // pane rendering fires handlePane's deferred roll and the skill is rolled twice, once
    // by it and once by us.
    resetHijackQuickRollState();

    const label = $(row).find(QUICK_ROLL_SKILL_NAME_SELECTOR).first();
    const paneClass = await openSkillPaneAndWait(label, skillName);
    if (!paneClass)
        return { ok: false, reason: "pane-timeout" };

    // A custom skill has no ability, so rollSkillCheck would have to ask which to use;
    // that prompt cannot be shown from a background tab.
    if ($("." + paneClass + "__header-ability").text().trim() === "--")
        return { ok: false, reason: "custom-skill" };

    return { ok: true, paneClass };
}

// Bring up one of the sheet's tabs ("Actions", "Spells") so its rows are on the page.
// Its markup has changed more than once, so the tab is found by its visible name.
// Returns false when there is no such tab, as in the mobile layout.
function showSheetTab(tabName) {
    const wanted = tabName.toLowerCase();
    const tab = $("[role='tab'], .ddbc-tab-list__nav-item, .ct-primary-box nav button, .ct-primary-box nav li, .ct-primary-box [class*='tab'] button")
        .filter((_, el) => el.textContent.trim().toLowerCase() === wanted)
        .first();
    if (tab.length === 0)
        return false;
    tab.trigger("click");
    return true;
}

// A row to roll from, switching to its tab when it is not on the page.
async function findRowOnTab(find, tabName) {
    const row = find();
    if (row) return { row };
    if (!showSheetTab(tabName)) return { reason: "not-visible" };
    const shown = await waitForSheet(find);
    return shown ? { row: shown } : { reason: "not-found" };
}

// Open the pane an attack row rolls from: the item, action or spell behind it.
async function prepareActionRoll(name) {
    const found = await findRowOnTab(() => findAttackRow(name), "Actions");
    if (!found.row)
        return { ok: false, reason: found.reason };

    // As for skills: a pending hover roll would fire again once the pane renders.
    resetHijackQuickRollState();

    const wanted = name.toLowerCase();
    const label = $(found.row).find(QUICK_ROLL_ATTACK_LABEL_SELECTOR).first();
    const paneClass = await waitForSheet(
        () => QUICK_ROLL_ACTION_PANES.find((paneClass) =>
            $("." + paneClass).length > 0 && quickRollActionPaneName(paneClass).toLowerCase() === wanted) || null,
        () => label.trigger("click"));
    return paneClass ? { ok: true, paneClass } : { ok: false, reason: "pane-timeout" };
}

// Open a spell's pane at the level of the row it was starred from.
async function prepareSpellRoll(name, level) {
    const found = await findRowOnTab(() => findSpellRow(name, level), "Spells");
    if (!found.row)
        return { ok: false, reason: found.reason };

    resetHijackQuickRollState();

    const wanted = name.toLowerCase();
    const nameElement = $(found.row).find(QUICK_ROLL_SPELL_NAME_SELECTOR).first();
    let reopened = false;
    const paneClass = await waitForSheet(() => {
        if ($(".ct-spell-pane").length === 0 || quickRollActionPaneName("ct-spell-pane").toLowerCase() !== wanted)
            return null;
        if (quickRollSpellPaneLevel().toLowerCase() === level.toLowerCase())
            return "ct-spell-pane";
        // Clicking the spell already open leaves its pane at the level it was showing, so
        // switch the pane away and back, as the sheet's own quick rolls do.
        if (!reopened) {
            reopened = true;
            $(".ddbc-character-tidbits__menu-callout").trigger("click");
            nameElement.trigger("click");
        }
        return null;
    }, () => {
        if (!reopened) nameElement.trigger("click");
    });
    return paneClass ? { ok: true, paneClass } : { ok: false, reason: "pane-timeout" };
}

// An explicit advantage or disadvantage from the launcher answers the roll-type query
// before it is asked, so only the whisper query is left to block on then.
function requiresInteractivePrompt(advantage) {
    return parseInt(character.getGlobalSetting("whisper-type", WhisperType.NO)) === WhisperType.QUERY ||
        (advantage === undefined && parseInt(character.getGlobalSetting("roll-type", RollType.NORMAL)) === RollType.QUERY);
}

// A remote quick roll, dispatched to the same functions the sheet's own buttons use, so
// every class feature, effect and custom modifier applies unchanged.
//
// The answer reports the roll was *accepted*, not that it finished: it then runs through
// the normal sendRoll pipeline, and waiting would leave the Roll20 panel spinning for no
// benefit. Failures before the roll starts are still reported, since those are the ones
// the player has to act on.
//
// `advantage` is "advantage", "disadvantage" or undefined for the sheet's own roll type;
// sendRoll applies it the way it applies the advantage hotkeys. `level` is a spell's
// level heading ("1st Level"), for spells only.
async function performRemoteQuickRoll(rollType, name, advantage, level) {
    if (b20_remote_roll_context)
        return { ok: false, reason: "busy" };

    const forced = { advantage: RollType.ADVANTAGE, disadvantage: RollType.DISADVANTAGE }[advantage];
    const ctx = b20_remote_roll_context = { prompt_blocked: false, advantage: forced };

    const release = () => {
        if (b20_remote_roll_context !== ctx)
            return;
        b20_remote_roll_context = null;
        // Anything the check below did not anticipate — the advantage query on
        // conflicting proficiency badges, for instance — is dropped rather than answered,
        // since the player cannot see the prompt.
        if (ctx.prompt_blocked)
            console.warn("Beyond20: a remote quick roll was dropped because it needed a prompt that cannot be shown from a hidden tab.");
    };

    const refuse = (reason) => {
        release();
        return { ok: false, reason };
    };

    // Answer "accepted" now. The context stays armed until the roll settles, which is
    // deliberately later than this function returns.
    const accept = (pending) => {
        Promise.resolve(pending)
            .catch((err) => console.error("Beyond20: remote quick roll failed", err))
            .then(release);
        return { ok: true };
    };

    try {
        // These settings would make sendRoll block on an alertify prompt this tab cannot
        // show, so report them rather than hanging.
        if (requiresInteractivePrompt(forced))
            return refuse("interactive-setting");

        if (rollType === "ability") {
            const row = findAbilityRow(name);
            return row ? accept(quickRollAbilityRow(row)) : refuse("not-found");
        }

        if (rollType === "saving-throw") {
            const row = findSaveRow(name);
            return row ? accept(quickRollSaveRow(row)) : refuse("not-found");
        }

        if (rollType === "initiative") {
            return getQuickRollInitiative() ? accept(rollInitiative()) : refuse("not-found");
        }

        if (rollType === "action" || rollType === "spell") {
            const prepared = rollType === "action" ? await prepareActionRoll(name) : await prepareSpellRoll(name, level);
            return prepared.ok ? accept(execute(prepared.paneClass)) : refuse(prepared.reason);
        }

        if (rollType === "skill") {
            // The proficiency and expertise badges live in the pane, so the roll has to
            // wait for it; the row alone does not say how good the character is.
            const prepared = await prepareSkillRoll(name);
            return prepared.ok ? accept(execute(prepared.paneClass)) : refuse(prepared.reason);
        }

        return refuse("bad-request");
    } catch (err) {
        release();
        throw err;
    }
}

// --- Hit points ------------------------------------------------------------ *
// Damage, healing and temporary hit points sent from the launcher's header. The sheet
// works out the new values and writes them into D&D Beyond's own HP Management pane,
// the same inputs Beyond20 reads hit points from, so D&D Beyond saves them as if the
// player had typed them.

const QUICK_ROLL_HP_PANE = ".b20-health-manage-pane";
let quick_roll_hp_busy = false;

function getQuickRollHp() {
    if (!character._max_hp) return null;
    return { current: character._hp || 0, max: character._max_hp, temp: character._temp_hp || 0 };
}

// Temporary hit points soak damage first, healing stops at the maximum, and new
// temporary hit points replace the old rather than adding to them.
function computeQuickRollHp(hp, mode, amount) {
    const { current, max, temp } = hp;
    if (mode === "temp")
        return { current, max, temp: amount };
    if (mode === "heal")
        return { current: Math.min(max, current + amount), max, temp };
    const absorbed = Math.min(temp, amount);
    return { current: Math.max(0, current - (amount - absorbed)), max, temp: temp - absorbed };
}

// The pane's Current and Temp inputs, read with the selectors Character.updateHP uses.
function quickRollHpInputs() {
    const pane = $(QUICK_ROLL_HP_PANE);
    let current = null;
    pane.find("div[class*='styles_container'] div[class*='styles_innerContainer'] div[class*='styles_item']").each((_, item) => {
        const label = $(item).find("label[class*='styles_label'], span[class*='styles_label']").text().trim();
        if (label === "Current" && !current)
            current = $(item).find("input[class*='styles_input']")[0] || null;
    });
    const temp = pane.find("div[class*='styles_container'] div[class*='styles_temp'] input[class*='styles_input']")[0] || null;
    return { current, temp };
}

// The hit point box on the sheet opens the HP Management pane. Its heading is clicked
// rather than its numbers, which edit in place.
function clickQuickRollHpBox() {
    const box = $(".ct-quick-info__health, .ct-health-summary, .ct-status-summary-mobile__hp").first();
    const heading = box.find("*").filter((_, el) =>
        el.children.length === 0 && /^hit points$/i.test(el.textContent.trim())).first();
    (heading.length ? heading : box).trigger("click");
}

// Type into a React-controlled input: set the value through the native setter, so React
// sees a change, and blur it, which is when D&D Beyond saves the field.
function setQuickRollInput(input, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    input.focus();
    setter.call(input, String(value));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.blur();
}

// Hit points as the sheet's own HP box shows them, which only changes once D&D Beyond
// has saved a change. (Character.updateHP prefers the pane's inputs while the pane is
// open, and those show whatever was typed.) Null where there is no such box, as in the
// mobile layout.
function readQuickRollHpSummary() {
    const box = $(".ct-health-summary__hp-group--primary, .ct-quick-info__health").first();
    if (box.length === 0) return null;
    let current = null;
    box.find(".ct-health-summary__hp-item, div[class*='styles_container'] div[class*='styles_innerContainer'] div[class*='styles_item']").each((_, item) => {
        const label = $(item).find("label[class*='styles_label'], span[class*='styles_label']").text().trim();
        if (label === "Current" && current === null) {
            const number = $(item).find("button[class*='styles_valueButton']");
            const value = parseInt(number.val() || number.text());
            if (!Number.isNaN(value)) current = value;
        }
    });
    if (current === null) return null;
    const tempItem = $(".ct-health-summary__hp-group--temp .ct-health-summary__hp-item--temp .ct-health-summary__hp-item-content, .ct-quick-info__health div[class*='styles_temp']").first();
    const tempValue = tempItem.find(".ct-health-summary__hp-number, button[class*='styles_valueButton'], input[class*='styles_input']");
    const temp = parseInt(tempValue.val() || tempValue.text()) || 0;
    return { current, temp };
}

function sameQuickRollHp(a, b) {
    return !!a && !!b && a.current === b.current && a.temp === b.temp;
}

// Each way this can fail has its own reason, and logs what the sheet looked like, since
// D&D Beyond's markup is the usual cause and the log is what it takes to fix it.
function quickRollHpFailure(reason, details) {
    console.warn("Beyond20: hit point change failed (" + reason + ")", details || "");
    return { ok: false, reason };
}

async function performRemoteHpChange(mode, amount) {
    if (quick_roll_hp_busy)
        return { ok: false, reason: "busy" };
    quick_roll_hp_busy = true;
    try {
        character.updateInfo();
        const before = getQuickRollHp();
        if (!before)
            return quickRollHpFailure("hp-unknown", { hp: character._hp, max: character._max_hp, temp: character._temp_hp });
        const target = computeQuickRollHp(before, mode, amount);
        if (sameQuickRollHp(before, target))
            return { ok: true, hp: before };

        const paneOpen = () => $(QUICK_ROLL_HP_PANE).length > 0;
        if (!paneOpen() && $(".ct-quick-info__health, .ct-health-summary, .ct-status-summary-mobile__hp").length === 0)
            return quickRollHpFailure("hp-box-not-found");
        const opened = await waitForSheet(() => paneOpen() && quickRollHpInputs().current ? true : null, clickQuickRollHpBox);
        const inputs = quickRollHpInputs();
        if (!paneOpen())
            return quickRollHpFailure("hp-pane-not-opened", { sidebar: $(".ct-sidebar__inner").first().prop("outerHTML") });
        if (!opened || !inputs.current || (target.temp !== before.temp && !inputs.temp))
            return quickRollHpFailure("hp-inputs-not-found", {
                current: !!inputs.current, temp: !!inputs.temp,
                pane: $(QUICK_ROLL_HP_PANE).first().prop("outerHTML")
            });

        if (target.temp !== before.temp)
            setQuickRollInput(inputs.temp, target.temp);
        if (target.current !== before.current)
            setQuickRollInput(inputs.current, target.current);

        // Answer with what the sheet shows once it settles, not what was asked for: if
        // D&D Beyond did not take the change, the player should hear so.
        const saved = () => readQuickRollHpSummary() || getQuickRollHp();
        const applied = await waitForSheet(() => {
            character.updateInfo();
            return sameQuickRollHp(saved(), target) ? true : null;
        });
        const now = { ...saved(), max: before.max };
        if (applied)
            return { ok: true, hp: now };
        return { ...quickRollHpFailure("hp-not-applied", { target, now, box: $(".ct-quick-info__health, .ct-health-summary").first().prop("outerHTML") }), hp: now };
    } finally {
        quick_roll_hp_busy = false;
    }
}
