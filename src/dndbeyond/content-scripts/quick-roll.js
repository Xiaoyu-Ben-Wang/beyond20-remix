/*from src/dndbeyond/base/utils.js import skillToAbility, abbreviationToAbility, normalizeAbilityName;
  from src/dndbeyond/base/dice.js import b20_remote_roll_context;
  from src/dndbeyond/content-scripts/character.js import scrapeAbilityRow, scrapeSavingThrowRow,
      quickRollAbilityRow, quickRollSaveRow, getOpenSkillPaneClass, getSkillPaneName, execute,
      resetHijackQuickRollState, rollInitiative, character;*/

// Remote quick rolls: rolls driven from the Roll20 side (see src/roll20/quick-roll.js),
// so a player can roll a skill, save, ability check or initiative without leaving the
// Roll20 tab. It also owns the favourite stars the sheet shows on those rolls.
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
// Desktop and tablet layouts. The mobile one has no class telling initiative apart from
// its neighbours, so it gets no favourite star; reading the value still covers it.
const QUICK_ROLL_INITIATIVE_SELECTOR =
    ".ct-combat__summary-group--initiative, .ct-combat-tablet__extra--initiative";
const QUICK_ROLL_INITIATIVE_VALUE_SELECTOR =
    ".ct-combat__summary-group--initiative span[class*='styles_numberDisplay'], " +
    ".ct-combat-tablet__extra--initiative span[class*='styles_numberDisplay'], " +
    ".ct-combat-mobile__extras > section[class*='styles_boxMobile'] span[class*='styles_numberDisplay']";
const QUICK_ROLL_INITIATIVE_NAME = "Initiative";

// Coarse upper bound on waiting for a skills pane to render; the wait itself is driven by
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
        favorites: loadQuickRollFavorites(character._id).map(parseQuickRollFavoriteKey)
    };
}

// --- Favourites ------------------------------------------------------------ *
// A star on each roll the launcher can make, so the player can pin the few they use most
// to the launcher's first tab. Kept in this site's localStorage, per character, as
// "rollType:name" keys in the order they were starred.

const QUICK_ROLL_FAVORITES_STORAGE_KEY = "beyond20-quick-roll-favorites";
const QUICK_ROLL_FAVORITE_TYPES = ["ability", "saving-throw", "skill", "initiative"];

function quickRollFavoriteKey(rollType, name) {
    return rollType + ":" + name;
}

function parseQuickRollFavoriteKey(key) {
    const split = typeof key === "string" ? key.indexOf(":") : -1;
    if (split <= 0) return null;
    const rollType = key.slice(0, split);
    const name = key.slice(split + 1);
    if (!QUICK_ROLL_FAVORITE_TYPES.includes(rollType) || !name) return null;
    return { rollType, name };
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
    return Array.isArray(list) ? list.filter((key) => parseQuickRollFavoriteKey(key)) : [];
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

// Adds the key if missing, removes it if present.
function toggleQuickRollFavorite(characterId, key) {
    const favorites = loadQuickRollFavorites(characterId);
    const index = favorites.indexOf(key);
    if (index === -1)
        favorites.push(key);
    else
        favorites.splice(index, 1);
    saveQuickRollFavorites(characterId, favorites);
}

// Where each kind of roll gets its star: the row whose hover reveals it, the element it
// sits in (null for the row itself), and the name the launcher knows the roll by.
const QUICK_ROLL_FAVORITE_TARGETS = [
    {
        rollType: "ability",
        row: QUICK_ROLL_ABILITY_ROW_SELECTOR,
        host: ".ct-ability-summary__heading, .ddbc-ability-summary__heading",
        name: (row) => scrapeAbilityRow(row).ability
    },
    {
        rollType: "saving-throw",
        row: QUICK_ROLL_SAVE_ROW_SELECTOR,
        host: ".ct-saving-throws-summary__ability-name, .ddbc-saving-throws-summary__ability-name",
        name: (row) => scrapeSavingThrowRow(row).ability
    },
    {
        rollType: "skill",
        row: QUICK_ROLL_SKILL_ROW_SELECTOR,
        host: QUICK_ROLL_SKILL_NAME_SELECTOR,
        name: (row) => scrapeSkillRow(row).name
    },
    {
        rollType: "initiative",
        row: QUICK_ROLL_INITIATIVE_SELECTOR,
        host: null,
        name: () => QUICK_ROLL_INITIATIVE_NAME
    }
];

function makeQuickRollFavoriteStar(key) {
    // The glyph comes from CSS rather than text, so the scrapers reading the name cell it
    // sits in never see it.
    const star = document.createElement("button");
    star.type = "button";
    star.className = "beyond20-qr-fav";
    star.dataset.beyond20Favorite = key;
    // Stopped here so the press never reaches the sheet's own handlers, which would open
    // the row's side pane or roll it.
    for (const type of ["mousedown", "pointerdown", "mouseup", "pointerup"])
        star.addEventListener(type, (ev) => ev.stopPropagation());
    star.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        if (!character._id) return;
        toggleQuickRollFavorite(character._id, star.dataset.beyond20Favorite);
        updateQuickRollFavoriteStars();
    });
    return star;
}

function setQuickRollFavoriteStarState(star, on) {
    // Only written on a real change: this runs from the sheet's MutationObserver, and a
    // write on every pass would keep waking it.
    if (star.classList.contains("beyond20-qr-fav-on") !== on)
        star.classList.toggle("beyond20-qr-fav-on", on);
    const title = on ? "Remove from Beyond20 quick roll favourites" : "Add to Beyond20 quick roll favourites";
    if (star.title !== title) {
        star.title = title;
        star.setAttribute("aria-label", title);
    }
}

// Called on every sheet mutation: the sheet re-renders its rows often, dropping anything
// added to them, so a missing star is simply put back.
function updateQuickRollFavoriteStars() {
    if (!settings["roll20-quick-roll-panel"] || !character._id) {
        $(".beyond20-qr-fav").remove();
        return;
    }

    const favorites = new Set(loadQuickRollFavorites(character._id));
    for (const target of QUICK_ROLL_FAVORITE_TARGETS) {
        $(target.row).each((_, row) => {
            const name = target.name(row);
            if (!name) return;
            const host = target.host ? $(row).find(target.host).first()[0] : row;
            if (!host) return;

            const key = quickRollFavoriteKey(target.rollType, name);
            let star = host.querySelector(":scope > .beyond20-qr-fav");
            if (!star) {
                row.classList.add("beyond20-qr-fav-row");
                host.classList.add("beyond20-qr-fav-host");
                star = makeQuickRollFavoriteStar(key);
                host.appendChild(star);
            } else if (star.dataset.beyond20Favorite !== key) {
                star.dataset.beyond20Favorite = key;
            }
            setQuickRollFavoriteStarState(star, favorites.has(key));
        });
    }
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

// The pane for a skill, opened by clicking the skill row if needed. Resolves to the pane
// class, or null on timeout.
function openSkillPaneAndWait(label, skillName) {
    return new Promise((resolve) => {
        const ready = () => {
            const paneClass = getOpenSkillPaneClass();
            if (!paneClass || getSkillPaneName(paneClass) !== skillName) return null;
            // The header fills in before the rest of the pane and the roll reads the
            // modifier from it, so don't hand the pane over until it is there.
            if ($("." + paneClass + "__header-modifier").length === 0) return null;
            return paneClass;
        };

        const already = ready();
        if (already) return resolve(already);

        let done = false;
        let observer = null;
        let timer = 0;

        const finish = (paneClass) => {
            if (done) return;
            done = true;
            if (observer) observer.disconnect();
            if (timer) clearTimeout(timer);
            resolve(paneClass);
        };

        // MutationObserver callbacks escape the background-tab timer throttling that
        // would stretch a setTimeout-based wait to about a minute.
        observer = new MutationObserver(() => {
            const paneClass = ready();
            if (paneClass) finish(paneClass);
        });
        observer.observe(document.body, { subtree: true, childList: true });

        timer = setTimeout(() => finish(null), QUICK_ROLL_PANE_TIMEOUT_MS);

        label.trigger("click");
    });
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
// sendRoll applies it the way it applies the advantage hotkeys.
async function performRemoteQuickRoll(rollType, name, advantage) {
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
