/*from src/dndbeyond/base/utils.js import skillToAbility, abbreviationToAbility, normalizeAbilityName;
  from src/dndbeyond/base/dice.js import b20_remote_roll_context;
  from src/dndbeyond/content-scripts/character.js import scrapeAbilityRow, scrapeSavingThrowRow,
      quickRollAbilityRow, quickRollSaveRow, getOpenSkillPaneClass, getSkillPaneName, execute,
      resetHijackQuickRollState, character;*/

// Remote quick rolls: rolls driven from the Roll20 side (see src/roll20/quick-roll.js),
// so a player can roll a skill, save or ability check without leaving the Roll20 tab.
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
        skills: getQuickRollSkills()
    };
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

function requiresInteractivePrompt() {
    return parseInt(character.getGlobalSetting("whisper-type", WhisperType.NO)) === WhisperType.QUERY ||
        parseInt(character.getGlobalSetting("roll-type", RollType.NORMAL)) === RollType.QUERY;
}

// A remote quick roll, dispatched to the same functions the sheet's own buttons use, so
// every class feature, effect and custom modifier applies unchanged.
//
// The answer reports the roll was *accepted*, not that it finished: it then runs through
// the normal sendRoll pipeline, and waiting would leave the Roll20 panel spinning for no
// benefit. Failures before the roll starts are still reported, since those are the ones
// the player has to act on.
async function performRemoteQuickRoll(rollType, name) {
    if (b20_remote_roll_context)
        return { ok: false, reason: "busy" };

    const ctx = b20_remote_roll_context = { prompt_blocked: false };

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
        if (requiresInteractivePrompt())
            return refuse("interactive-setting");

        if (rollType === "ability") {
            const row = findAbilityRow(name);
            return row ? accept(quickRollAbilityRow(row)) : refuse("not-found");
        }

        if (rollType === "saving-throw") {
            const row = findSaveRow(name);
            return row ? accept(quickRollSaveRow(row)) : refuse("not-found");
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
