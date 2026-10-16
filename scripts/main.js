// WFRP4e: Same Kości (koścista natura szkieletów)
// v1.2.0
//
// Zasada opcjonalna „SAME KOŚCI": ataki BEZ cechy Ogłuszająca (w systemie: Pummel)
// zadają oznaczonemu stworzeniu -1 punkt Obrażeń do Ran.
//
// Podejście „jak Krzepki (Hardy)": logika jest WBUDOWANA w samą cechę — efekt cechy niesie
// skrypt na triggerze `takeDamage`, który mutuje `args.totalWoundLoss`. Dzięki temu reguła
// podróżuje z cechą i działa przez natywny silnik skryptów systemu (warhammer-lib), niezależnie
// od kodu tego modułu. Rola modułu sprowadza się do DOSTARCZENIA cechy w kompendium.

const MODULE_ID = "wfrp4e-bare-bones";
const PACK_ID = "wfrp4e-bare-bones.same-kosci"; // pack zadeklarowany w module.json
const TRAIT_NAME = "Same Kości";
const TRAIT_IMG = "modules/wfrp4e-core/icons/traits/trait.png";

// Skrypt efektu (trigger "takeDamage"): -1 do Ran, o ile atak nie ma cechy Ogłuszająca (Pummel).
// Kontekst: `args` (scriptArgs obrażeń), `this.effect`, `this.actor`, `this.item`. Bez top-level `return`.
const SAME_KOSCI_SCRIPT = [
  "const item = args.sourceItem;",
  "const inScope = item && (item.type === \"weapon\" || item.type === \"trait\");",
  "if (inScope) {",
  "  const q = item.properties?.qualities;",
  "  const hasPummel = (q && q.pummel) ||",
  "    (item.system?.qualities?.value || []).some(x => String(x?.name || \"\").toLowerCase() === \"pummel\");",
  "  if (!hasPummel && args.totalWoundLoss > 0) {",
  "    args.totalWoundLoss = Math.max(0, args.totalWoundLoss - 1);",
  "    args.modifiers.other.push({ label: this.effect.name, value: -1 });",
  "  }",
  "}",
].join("\n");

const DESC_HTML =
  "<p><strong>Zasada opcjonalna: Same Kości.</strong></p>" +
  "<p>Aby oddać kościstą naturę szkieletów, ataki <strong>bez cechy Ogłuszająca</strong> " +
  "(w systemie: <em>Pummel</em>) zadają temu stworzeniu <strong>-1 punkt Obrażeń do Ran</strong>. " +
  "Broń obuchowa (Ogłuszająca/Pummel) zadaje pełne obrażenia.</p>" +
  "<p><em>Cecha jest samodzielna (jak Krzepki) — wystarczy ją przeciągnąć na stworzenie.</em></p>";

/** Dokument cechy „Same Kości": trait z wbudowanym efektem niosącym skrypt takeDamage. */
function traitData() {
  return {
    name: TRAIT_NAME,
    type: "trait",
    img: TRAIT_IMG,
    system: { description: { value: DESC_HTML } },
    effects: [
      {
        name: TRAIT_NAME,
        img: TRAIT_IMG,
        type: "base",
        transfer: true,
        system: {
          transferData: { type: "document", documentType: "Actor" },
          scriptData: [
            { trigger: "takeDamage", label: TRAIT_NAME, script: SAME_KOSCI_SCRIPT, async: false },
          ],
        },
      },
    ],
    flags: { [MODULE_ID]: { marker: true } },
  };
}

/**
 * Samonaprawa kompendium modułu (backup, gdyby zabutelkowane dane się nie wczytały):
 * jeśli pack `wfrp4e-bare-bones.same-kosci` jest pusty, utwórz w nim cechę „Same Kości".
 * Działa wyłącznie na packu z manifestu (bez packa świata) → brak duplikatów. Idempotentne.
 */
async function ensureCompendiumTrait() {
  if (!game.user?.isGM) return;
  try {
    const pack = game.packs.get(PACK_ID);
    if (!pack) {
      console.warn(`${MODULE_ID} | Brak kompendium ${PACK_ID} — pomijam.`);
      return;
    }
    const index = await pack.getIndex();
    if (index.size > 0) return; // już wypełnione → nic nie rób

    if (pack.locked) await pack.configure({ locked: false });
    await Item.create(traitData(), { pack: PACK_ID });
    console.log(`${MODULE_ID} | Dodano cechę „${TRAIT_NAME}" do kompendium „${PACK_ID}".`);
  } catch (e) {
    console.error(`${MODULE_ID} | Błąd przy uzupełnianiu kompendium`, e);
  }
}

Hooks.once("ready", async () => {
  if (game.system.id !== "wfrp4e") {
    console.warn(`${MODULE_ID} | System to '${game.system.id}', nie 'wfrp4e' — moduł pozostanie nieaktywny.`);
    return;
  }
  const mod = game.modules.get(MODULE_ID);
  if (mod) mod.api = { seedTrait: ensureCompendiumTrait, traitData };

  await ensureCompendiumTrait();

  console.log(`${MODULE_ID} | Gotowe. Przeciągnij cechę „Same Kości" z kompendium na stworzenie.`);
});
