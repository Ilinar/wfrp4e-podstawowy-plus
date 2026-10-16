// WFRP4e: Praktyczne narzędzia (Rzemiosło) — część modułu „Podstawowy+".
//
// Reguła: praktyczne narzędzie rzemieślnicze daje +1 PS przy NIEUDANYM teście
// umiejętności Rzemiosło — ale tylko gdy specjalizacja w nazwie narzędzia (w nawiasie)
// zgadza się ze specjalizacją testowanej umiejętności (np. Rzemiosło (Stolarstwo)
// ↔ narzędzie „… (Stolarstwo)"). Nawias „(Rzemiosło dowolne)" / „(dowolne)" / „(any)" / „(*)"
// to wildcard — pasuje do każdej specjalizacji Rzemiosła.
//
// Odwzorowuje natywne zachowanie cechy Practical dla broni
// (AttackTest.computeProperties: `this.result.SL++` przy porażce), którego system nie
// stosuje do testów umiejętności. Wpięcie przez publiczny hook `wfrp4e:rollTest`
// (emitowany PRZED renderRollCard), więc podbity PS trafia na kartę. Jak w systemie dla
// broni — opis wyniku (description) NIE jest przeliczany po zmianie PS.
//
// Dodatkowo moduł dostarcza w kompendium gotowy uniwersalny przedmiot
// „Praktyczne narzędzia pracy (Rzemiosło dowolne)".

const MODULE_ID = "wfrp4e-bare-bones";
const SETTING = "practicalTools";
const TRADE_TOOL_TYPES = ["toolsAndKits", "tradeTools"];

const PACK_ID = `${MODULE_ID}.same-kosci`; // wspólny pack „Podstawowy+" (współdzielony z cechą „Same Kości")
const TOOL_NAME = "Praktyczne narzędzia pracy (Rzemiosło dowolne)";
const TOOL_IMG = "icons/svg/item-bag.svg";

const loc = (k) => game.i18n.localize(k);

/** Normalizacja do porównań: małe litery, bez polskich ogonków, pojedyncze spacje. */
const PL_DIACRITICS = { "ą": "a", "ć": "c", "ę": "e", "ł": "l", "ń": "n", "ó": "o", "ś": "s", "ź": "z", "ż": "z" };
function norm(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (c) => PL_DIACRITICS[c] ?? c)
    .replace(/\s+/g, " ")
    .trim();
}

/** Bazowa nazwa umiejętności (bez specjalizacji): „Rzemiosło (Stolarstwo)" → „Rzemiosło". */
function baseName(name) {
  return String(name ?? "").split("(")[0].trim();
}

/** Surowa treść z nawiasu (do wyświetlenia): „… (Stolarstwo)" → „Stolarstwo". */
function rawSpec(name) {
  return (String(name ?? "").match(/\(([^)]*)\)/)?.[1] ?? "").trim();
}

/** Specjalizacje z nawiasu, znormalizowane (kilka po przecinku/ukośniku): „(Stolarstwo, Kowalstwo)" → ["stolarstwo","kowalstwo"]. */
function specList(name) {
  const inner = String(name ?? "").match(/\(([^)]*)\)/)?.[1];
  if (!inner) return [];
  return inner.split(/[,/]/).map(norm).filter(Boolean);
}

/** Czy token z nawiasu to wildcard pasujący do każdej specjalizacji. */
function isWildcard(token) {
  return token === "*" || token === "any" || token.includes("dowoln");
}

/* -------------------------------------------- */
/*  Ustawienie (świat, GM)                      */
/* -------------------------------------------- */
Hooks.once("init", () => {
  game.settings.register(MODULE_ID, SETTING, {
    name: "PP.PracticalTools.Enabled.Name",
    hint: "PP.PracticalTools.Enabled.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });
});

/* -------------------------------------------- */
/*  Reguła: +1 PS przy porażce testu Rzemiosła  */
/* -------------------------------------------- */
// Po wykonaniu testu, przed renderem karty. Błąd nie może popsuć wyniku testu.
Hooks.on("wfrp4e:rollTest", (test) => {
  try {
    if (game.system?.id !== "wfrp4e") return;
    if (!game.settings.get(MODULE_ID, SETTING)) return;

    const skill = test?.item;
    if (skill?.type !== "skill") return;                                 // tylko test umiejętności
    if (!test.failed) return;                                            // tylko porażka (RAW)
    if (norm(baseName(skill.name)) !== norm(loc("NAME.Trade"))) return;  // tylko Rzemiosło

    const skillSpecs = specList(skill.name);
    if (!skillSpecs.length) return;                                      // brak specjalizacji = brak dopasowania

    const tools = (test.actor?.itemTypes?.trapping ?? []).filter((i) => {
      if (!TRADE_TOOL_TYPES.includes(i.system?.trappingType?.value)) return false;
      if (!i.properties?.qualities?.practical) return false;
      // nawias narzędzia = nawias umiejętności, albo wildcard (dowolne/any/*)
      return specList(i.name).some((s) => isWildcard(s) || skillSpecs.includes(s));
    });
    if (!tools.length) return;

    // +1 PS jak natywnie dla broni (bez kumulacji, bez przeliczania opisu).
    test.result.SL = Number(test.result.SL) + 1;
    test.result.other = test.result.other || [];
    test.result.other.push(game.i18n.format("PP.PracticalTools.Note", { spec: rawSpec(skill.name) }));
  } catch (e) {
    console.error(`${MODULE_ID} | praktyczne narzędzia — błąd (wynik bez zmian)`, e);
  }
});

/* -------------------------------------------- */
/*  Gotowy przedmiot w kompendium               */
/* -------------------------------------------- */
// Uwaga: literał szablonowy (backtick) — bezpieczny na cudzysłowy w treści HTML.
const TOOL_DESC_HTML =
  `<p><strong>Praktyczne narzędzia pracy.</strong> Fachowo wykonany, uniwersalny zestaw ` +
  `rzemieślniczy z cechą <em>Praktyczny</em>.</p>` +
  `<p>Przy <strong>nieudanym</strong> teście <strong>Rzemiosła</strong> (dowolnej specjalizacji) ` +
  `wynik otrzymuje <strong>+1 PS</strong> (reguła modułu „Podstawowy+”).</p>` +
  `<p><em>Działa dzięki dopiskowi „(Rzemiosło dowolne)” w nazwie — pasuje do każdej specjalizacji.</em></p>`;

/** Dokument trappingu „Praktyczne narzędzia pracy (Rzemiosło dowolne)".
 *  Minimalne, bezpieczne pola — resztę (encumbrance/quantity/location/flaws) uzupełni DataModel.
 *  (Wcześniej `location:{value:0}` kolidowało ze StringField w schemacie i mogło wywalać Item.create.) */
function toolData() {
  return {
    name: TOOL_NAME,
    type: "trapping",
    img: TOOL_IMG,
    system: {
      description: { value: TOOL_DESC_HTML },
      trappingType: { value: "toolsAndKits" },
      price: { gc: 6 },
      availability: { value: "exotic" },
      qualities: { value: [{ name: "practical" }] },
    },
    flags: { [MODULE_ID]: { practicalTool: true } },
  };
}

/**
 * Dodaje przedmiot do WSPÓLNEGO packa „Podstawowy+" (tego samego, w którym jest
 * cecha „Same Kości"), o ile jeszcze go tam nie ma. Sprawdzenie po nazwie → brak duplikatów,
 * niezależnie od innych dokumentów w packu. Idempotentne. GM-only.
 */
async function ensureCompendiumTool() {
  if (!game.user?.isGM) return;
  try {
    const pack = game.packs.get(PACK_ID);
    if (!pack) {
      console.warn(`${MODULE_ID} | Brak kompendium ${PACK_ID} — pomijam.`);
      ui.notifications?.warn(`Podstawowy+: nie znaleziono kompendium ${PACK_ID}.`);
      return;
    }
    const index = await pack.getIndex();
    if (index.find((e) => e.name === TOOL_NAME)) return; // przedmiot już jest → nic nie rób

    if (pack.locked) await pack.configure({ locked: false });
    const created = await Item.create(toolData(), { pack: PACK_ID });
    console.log(`${MODULE_ID} | Dodano „${TOOL_NAME}" do kompendium „${PACK_ID}".`, created?.uuid);
    ui.notifications?.info(`Podstawowy+: dodano „${TOOL_NAME}" do kompendium.`);
  } catch (e) {
    console.error(`${MODULE_ID} | Błąd przy uzupełnianiu kompendium narzędzi`, e);
    ui.notifications?.error(`Podstawowy+: nie udało się dodać narzędzia — ${e?.message ?? e}`);
  }
}

Hooks.once("ready", async () => {
  if (game.system?.id !== "wfrp4e") return;
  const mod = game.modules.get(MODULE_ID);
  if (mod) mod.api = Object.assign(mod.api ?? {}, { seedPracticalTool: ensureCompendiumTool, toolData });
  await ensureCompendiumTool();
});
