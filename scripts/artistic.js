// WFRP4e: Talent Artystyczny — część modułu „Podstawowy+".
//
// Opis talentu: „dodajesz Umiejętność Sztuka (Dowolna) do swojej każdej bieżącej Profesji, a jeśli
// znajduje się ona na liście, koszt każdego Rozwinięcia spada o 5 PD". Talent z wfrp4e-core ma
// tylko premię do testów Sztuki — brakuje mu skryptu, który mają Rzemieślnik i Słuch Absolutny
// (trigger prepareData: `currentCareer.system.addedSkills.push(...)` albo `costModifier = -5`).
// Moduł robi to samo, nie zmieniając danych talentu.
//
// Wpięcie: owinięcie CharacterModel#computeCareer (PRZED oryginałem) — tam system łączy
// skills + addedSkills Profesji z umiejętnościami postaci (znacznik na karcie, przycisk rozwinięcia
// w zakładce Profesji), a okno rozwinięcia liczy koszt x2 dla umiejętności spoza Profesji.
// Bez lib-wrapper. Zmiany są tylko w przygotowanych danych — nic nie zapisuje się w bazie.
//
// Która Sztuka (talent daje jedną, „Dowolną"):
//  1. Sztuka postaci jest już w Profesji → −5 PD za Rozwinięcie,
//  2. Profesja ma „Sztuka (Dowolna)" → Sztuka postaci trafia do Profesji i ma −5 PD
//     (system porównuje nazwy dosłownie, więc sam by jej nie uznał),
//  3. inaczej → Sztuka z największą liczbą Rozwinięć trafia do Profesji (normalny koszt).

const MODULE_ID = "wfrp4e-bare-bones";
const SETTING = "artisticTalent";
const SOURCE_ID = "Compendium.wfrp4e-core.items.Item.2eq8Ejotk54AZYwX";
const TALENT_NAMES = ["artistic", "talent artystyczny"]; // po norm()

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

/** Bazowa nazwa umiejętności (bez specjalizacji): „Sztuka (Malarstwo)" → „Sztuka". */
function baseName(name) {
  return String(name ?? "").split("(")[0].trim();
}

/** Specjalizacja z nawiasu, znormalizowana: „Sztuka (Malarstwo)" → „malarstwo" ("" gdy brak). */
function spec(name) {
  return norm(String(name ?? "").match(/\(([^)]*)\)/)?.[1]);
}

/** Czy specjalizacja to „dowolna" (Dowolna / Dowolny / Any / *). */
function isWildcard(token) {
  return token === "*" || token === "any" || token.includes("dowoln");
}

/** Czy przedmiot to Talent Artystyczny (po źródle z kompendium albo po nazwie PL/EN). */
function isArtistic(item) {
  const src = item?._stats?.compendiumSource ?? item?.flags?.core?.sourceId;
  return src === SOURCE_ID || TALENT_NAMES.includes(norm(item?.name));
}

/** Talent ma już własny skrypt prepareData (wklejony ręcznie albo z nowszej wersji systemu) → nie dubluj. */
function hasOwnScript(item) {
  return Array.from(item?.effects ?? []).some((e) =>
    (e.system?.scriptData ?? []).some((s) => s.trigger === "prepareData"));
}

// prepareData bywa wołane kilka razy na tych samych danych → zapamiętujemy, co już zrobiliśmy.
// Klucze to obiekty `system` (po resecie dokumentu są nowe, więc stan znika razem z nimi).
const ADDED = new WeakMap();     // system Profesji → nazwa dopisanej przez nas Sztuki
const DISCOUNTED = new WeakSet(); // system umiejętności, której daliśmy już −5 PD

function discount(skill) {
  const adv = skill.system?.advances;
  if (!adv || DISCOUNTED.has(skill.system)) return;
  adv.costModifier = (Number(adv.costModifier) || 0) - 5;
  DISCOUNTED.add(skill.system);
}

/**
 * Reguła dla jednej postaci. Wołane z CharacterModel#computeCareer, przed oryginałem.
 * @param {object} model  CharacterModel (`this` w computeCareer)
 */
function applyArtistic(model) {
  const actor = model?.parent;
  const career = model?.currentCareer;
  if (!actor || !career?.system) return;

  const talent = (actor.itemTypes?.talent ?? []).find(isArtistic);
  if (!talent || hasOwnScript(talent)) return;

  const art = norm(loc("NAME.Art"));
  const isArt = (name) => norm(baseName(name)) === art;
  // Sztukę trzeba mieć na karcie z wybraną specjalizacją — talent jej nie tworzy.
  const artSkills = (actor.itemTypes?.skill ?? []).filter((s) => isArt(s.name) && spec(s.name) && !isWildcard(spec(s.name)));
  if (!artSkills.length) return;

  const sys = career.system;
  const ours = ADDED.get(sys);
  const listed = [...(sys.skills ?? []), ...(sys.addedSkills ?? []).filter((n) => n !== ours)];

  // 1) Sztuka postaci już jest w Profesji
  const inCareer = artSkills.find((s) => listed.includes(s.name));
  if (inCareer) return discount(inCareer);

  // 2) / 3) dopisz jedną Sztukę do Profesji
  const skill = artSkills.reduce((best, s) => (Number(s.system?.advances?.value) || 0) > (Number(best.system?.advances?.value) || 0) ? s : best);
  if (ours !== skill.name) {
    sys.addedSkills.push(skill.name);
    ADDED.set(sys, skill.name);
  }
  if (listed.some((n) => isArt(n) && isWildcard(spec(n)))) discount(skill);
}

/* -------------------------------------------- */
/*  Ustawienie + wpięcie (init, po systemie)    */
/* -------------------------------------------- */
// System rejestruje CONFIG.Actor.dataModels w swoim init, który biegnie przed init modułów.
// Dokumenty świata przygotowują się później, więc owinięcie zdąży przed pierwszym computeCareer.
Hooks.once("init", () => {
  game.settings.register(MODULE_ID, SETTING, {
    name: "PP.Artistic.Enabled.Name",
    hint: "PP.Artistic.Enabled.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    requiresReload: true,
  });

  if (game.system?.id !== "wfrp4e") return;
  const proto = CONFIG.Actor?.dataModels?.character?.prototype;
  if (typeof proto?.computeCareer !== "function") {
    console.warn(`${MODULE_ID} | Talent Artystyczny: brak CharacterModel#computeCareer — reguła nieaktywna.`);
    return;
  }
  const original = proto.computeCareer;
  proto.computeCareer = function (...args) {
    try {
      if (game.settings.get(MODULE_ID, SETTING)) applyArtistic(this);
    } catch (e) {
      console.error(`${MODULE_ID} | Talent Artystyczny — błąd (Profesja bez zmian)`, e);
    }
    return original.apply(this, args);
  };
});
