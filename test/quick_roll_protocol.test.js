// Standalone tests for the quick roll launcher's decision logic and panel stylesheet.
// Run with: node test/quick_roll_protocol.test.js
//
// The functions are extracted from their sources at runtime, so this file stays in sync
// without the project's bundler. Exits 1 on any failure.

const fs = require('fs');
const path = require('path');

// Pull a top-level `function <name>(...) { ... }` out of a source file by matching
// braces. The files are plain concatenated scripts with no modules, so this is all the
// "import" machinery needed.
function extractFunction(src, name, file) {
    const start = src.indexOf(`\nfunction ${name}(`);
    if (start < 0) {
        console.error(`FAIL: Could not locate ${name}() in ${file}`);
        process.exit(2);
    }

    let depth = 0;
    let begun = false;
    let quote = null;
    for (let i = start; i < src.length; i++) {
        const c = src[i];
        if (quote) {
            if (c === "\\") i++;
            else if (c === quote) quote = null;
            continue;
        }
        if (c === '"' || c === "'" || c === "`") {
            quote = c;
            continue;
        }
        if (c === "{") {
            depth++;
            begun = true;
        } else if (c === "}") {
            depth--;
            if (begun && depth === 0)
                // eslint-disable-next-line no-eval
                return eval("(" + src.slice(start, i + 1).trim() + ")");
        }
    }
    console.error(`FAIL: Unterminated ${name}() in ${file}`);
    process.exit(2);
}

function load(file, name) {
    const full = path.join(__dirname, '..', file);
    return extractFunction(fs.readFileSync(full, 'utf8'), name, file);
}

const selectQuickRollCharacter = load('src/roll20/quick-roll.js', 'selectQuickRollCharacter');

// quickRollSectionBlocks reads these from the module scope it lives in, which eval does
// not reproduce, so they are declared here for it to resolve against. A mismatch with
// the real ones fails rather than passing quietly.
const QUICK_ROLL_ABILITY_ORDER = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];
let quick_roll_data = null;
const quickRollRow = load('src/roll20/quick-roll.js', 'quickRollRow');
const quickRollSectionBlocks = load('src/roll20/quick-roll.js', 'quickRollSectionBlocks');

const isValidQuickRollRequest = load('src/extension/background.js', 'isValidQuickRollRequest');

// The panel's stylesheet with the ${...} interpolations performed: the bundle is a plain
// concatenation, so the template literal reaches the page verbatim and only the browser
// resolves it, and reading it here needs the same substitution.
const quickRollSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src/roll20/quick-roll.js'), 'utf8');

function loadCSS() {
    const consts = {};
    for (const m of quickRollSrc.matchAll(/const (QUICK_ROLL_\w+) = "([^"]*)"/g))
        consts[m[1]] = m[2];
    for (const m of quickRollSrc.matchAll(/const (QUICK_ROLL_\w+) = (\d+)/g))
        consts[m[1]] = Number(m[2]);
    const names = Object.keys(consts);
    const start = quickRollSrc.indexOf('const QUICK_ROLL_CSS = `');
    const end = quickRollSrc.indexOf('\n`;', start);
    return quickRollSrc.slice(start, end).replace(/\$\{([^}]*)\}/g, (_, expr) =>
        // eslint-disable-next-line no-new-func
        String(new Function(...names, `"use strict"; return (${expr});`)(
            ...names.map((n) => consts[n]))));
}

const alice = { id: "100", name: "Alice" };
const bob = { id: "200", name: "Bob" };

const cases = [];

function check(name, run, expect) {
    let got;
    try {
        got = run();
    } catch (err) {
        got = "threw: " + err.message;
    }
    const ok = JSON.stringify(got) === JSON.stringify(expect);
    cases.push({ name, ok, got, expect });
}

// --- selectQuickRollCharacter --------------------------------------------- *
// The point of this function is that it never guesses: rolling the wrong character's
// Perception into chat is indistinguishable from success, so an ambiguous situation must
// ask rather than pick.

check("no D&D Beyond sheet open",
    () => selectQuickRollCharacter([], null).state,
    "none");

check("null responders are treated as none",
    () => selectQuickRollCharacter(null, null).state,
    "none");

check("responders with no id are dropped",
    () => selectQuickRollCharacter([{ name: "loading" }, { id: "", name: "blank" }], null).state,
    "none");

check("single sheet is used without asking",
    () => selectQuickRollCharacter([alice], null),
    { state: "ready", character: alice });

check("remembered sheet wins among several",
    () => selectQuickRollCharacter([alice, bob], { id: "200" }).character,
    bob);

check("remembered id matches across number/string",
    () => selectQuickRollCharacter([alice, bob], { id: 200 }).character,
    bob);

check("several sheets with no memory asks instead of guessing",
    () => selectQuickRollCharacter([alice, bob], null).state,
    "picker");

check("remembered sheet that is not open reports the mismatch",
    () => selectQuickRollCharacter([bob], { id: "100", name: "Alice" }),
    { state: "stale", remembered: { id: "100", name: "Alice" }, characters: [bob] });

check("an empty memory does not count as remembered",
    () => selectQuickRollCharacter([alice, bob], {}).state,
    "picker");

// --- quickRollSectionBlocks ----------------------------------------------- *
// Skills are the long list: 18 rows at roughly 21px, plus a header, the tab row and
// padding, comes to about 455px against the panel's max-height of min(88vh, 640px).

// A real sheet's skills: 18 of them, and no CON because D&D 5e has none.
const SHEET_SKILLS = [
    { name: "Athletics", ability: "STR" },
    { name: "Acrobatics", ability: "DEX" }, { name: "Sleight of Hand", ability: "DEX" },
    { name: "Stealth", ability: "DEX" },
    { name: "Arcana", ability: "INT" }, { name: "History", ability: "INT" },
    { name: "Investigation", ability: "INT" }, { name: "Nature", ability: "INT" },
    { name: "Religion", ability: "INT" },
    { name: "Animal Handling", ability: "WIS" }, { name: "Insight", ability: "WIS" },
    { name: "Medicine", ability: "WIS" }, { name: "Perception", ability: "WIS" },
    { name: "Survival", ability: "WIS" },
    { name: "Deception", ability: "CHA" }, { name: "Intimidation", ability: "CHA" },
    { name: "Performance", ability: "CHA" }, { name: "Persuasion", ability: "CHA" },
].map((s) => ({ ...s, modifier: "+5" }));

function withSheet(skills, fn) {
    quick_roll_data = { id: "1", name: "Alice", abilities: [], saves: [], skills };
    try {
        return fn();
    } finally {
        quick_roll_data = null;
    }
}

// Rows the list occupies. One roll per row, so it is a plain total — and the total is
// what has to stay inside the panel's height budget.
function gridRows(blocks) {
    return blocks.reduce((total, b) => total + b.rows.length, 0);
}

check("skills are grouped under their ability, in a fixed order",
    () => withSheet(SHEET_SKILLS, () => quickRollSectionBlocks("skills").map((b) => b.group)),
    ["STR", "DEX", "INT", "WIS", "CHA"]);

check("no block is emitted for an ability with no skills",
    () => withSheet(SHEET_SKILLS, () => quickRollSectionBlocks("skills").some((b) => b.group === "CON")),
    false);

check("every skill survives the grouping",
    () => withSheet(SHEET_SKILLS, () =>
        quickRollSectionBlocks("skills").reduce((n, b) => n + b.rows.length, 0)),
    SHEET_SKILLS.length);

check("a custom skill, which has no ability, is left out",
    () => withSheet([...SHEET_SKILLS, { name: "Homebrew Lore", ability: "", modifier: "+2" }],
        () => quickRollSectionBlocks("skills").reduce((n, b) => n + b.rows.length, 0)),
    SHEET_SKILLS.length);

check("skill rows carry what the roll needs",
    () => withSheet(SHEET_SKILLS, () => quickRollSectionBlocks("skills")[0].rows[0]),
    { rollType: "skill", name: "Athletics", label: "Athletics", modifier: "+5" });

check("the skills list is 18 rows, one per skill",
    () => withSheet(SHEET_SKILLS, () => gridRows(quickRollSectionBlocks("skills"))),
    18);

// A block with no rows would still render its label, leaving a stray ability name above
// nothing. Only the abilities a skill belongs to get a block.
check("no block is emitted empty",
    () => withSheet(SHEET_SKILLS, () => quickRollSectionBlocks("skills").every((b) => b.rows.length > 0)),
    true);

check("saves and checks are one unlabelled block, not grouped",
    () => withSheet(SHEET_SKILLS, () => {
        quick_roll_data.saves = [{ name: "Dexterity", abbr: "DEX", modifier: "+2" }];
        return quickRollSectionBlocks("saves").map((b) => b.group || null);
    }),
    [null]);

check("a save rolls by its abbreviation",
    () => withSheet(SHEET_SKILLS, () => {
        quick_roll_data.saves = [{ name: "Dexterity", abbr: "DEX", modifier: "+2" }];
        return quickRollSectionBlocks("saves")[0].rows[0];
    }),
    { rollType: "saving-throw", name: "DEX", label: "Dexterity", modifier: "+2" });

check("an ability check rolls by its abbreviation",
    () => withSheet(SHEET_SKILLS, () => {
        quick_roll_data.abilities = [{ name: "Strength", abbr: "STR", modifier: "+4" }];
        return quickRollSectionBlocks("checks")[0].rows[0];
    }),
    { rollType: "ability", name: "STR", label: "Strength", modifier: "+4" });

// --- isValidQuickRollRequest ---------------------------------------------- *
// The background is the only place that sees requests from a page, so it is where a
// malformed one has to be turned away.

check("a well formed skill request is accepted",
    () => isValidQuickRollRequest({ characterId: "100", rollType: "skill", name: "Perception" }),
    true);

check("a saving throw request is accepted",
    () => isValidQuickRollRequest({ characterId: 100, rollType: "saving-throw", name: "DEX" }),
    true);

check("an ability check request is accepted",
    () => isValidQuickRollRequest({ characterId: "100", rollType: "ability", name: "STR" }),
    true);

check("an unknown roll type is refused",
    () => isValidQuickRollRequest({ characterId: "100", rollType: "attack", name: "Longsword" }),
    false);

check("a request with no character is refused",
    () => isValidQuickRollRequest({ rollType: "skill", name: "Perception" }),
    false);

check("a request with no roll name is refused",
    () => isValidQuickRollRequest({ characterId: "100", rollType: "skill", name: "" }),
    false);

check("a non-string roll name is refused",
    () => isValidQuickRollRequest({ characterId: "100", rollType: "skill", name: { toString: "nope" } }),
    false);

check("an absurdly long roll name is refused",
    () => isValidQuickRollRequest({ characterId: "100", rollType: "skill", name: "x".repeat(500) }),
    false);

// --- QUICK_ROLL_CSS scoping ----------------------------------------------- *
// The character menu nests in the panel header so it can hang off the header's bottom
// edge. That nesting is what makes the header's element rules dangerous: with a plain
// descendant selector, `header img` resized every avatar to the portrait's size and
// `header button` forced each menu entry to 20x20, squeezing the names out and leaving
// bare portraits. The header's rules stay child selectors while it is nested.

const css = loadCSS();

check("the character menu is still nested inside the header",
    () => /header\.appendChild\(characterMenu\)/.test(quickRollSrc),
    true);

check("no header descendant selector can reach the nested menu",
    () => /\.beyond20-qr-header\s+(?!>)\s*[a-zA-Z]/.test(css),
    false);

check("the menu still sizes its own entries",
    () => [".beyond20-qr-char-menu button", ".beyond20-qr-char-menu img"]
        .every((sel) => css.includes(sel + " {")),
    true);

// A width or height here would beat the header's rules by specificity and squeeze the
// name out again.
check("no rule fixes the size of a menu entry",
    () => /\.beyond20-qr-char-menu button\s*\{[^}]*[;{\s](?:width|height):/.test(css),
    false);

check("the menu's avatars are not the portrait's size",
    () => /\.beyond20-qr-char-menu img\s*\{[^}]*width:\s*(\d+)px/.exec(css)[1] !==
          /\.beyond20-qr-header > img\s*\{[^}]*width:\s*(\d+)px/.exec(css)[1],
    true);

let pass = 0;
const failures = [];
for (const tc of cases) {
    if (tc.ok) {
        pass++;
        console.log(`PASS  ${tc.name}`);
    } else {
        failures.push(tc);
        console.log(`FAIL  ${tc.name}`);
        console.log(`      expected: ${JSON.stringify(tc.expect)}`);
        console.log(`      got:      ${JSON.stringify(tc.got)}`);
    }
}

console.log(`\n${pass}/${cases.length} passed`);
process.exit(failures.length ? 1 : 0);
