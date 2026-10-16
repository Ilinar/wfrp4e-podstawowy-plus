// WFRP4e: Zatrucie — część modułu „Podstawowy+".
//
// System (wfrp4e 9.5 + core-pl) na koniec Rundy wrzuca do czatu tylko przycisk
// „Zastosuj Zatrucie" (obrażenia). Brakuje dwóch rzeczy z podręcznika, które dokłada ta reguła:
//
//  1. Pod koniec każdej Rundy postać może wykonać Test Odporności (Wymagający +0). Sukces zdejmuje
//     1 poziom Zatrucia + 1 za każdy PS. Test Leczenia (inna postać) działa tak samo. Po zdjęciu
//     wszystkich poziomów system sam dodaje Zmęczenie (Actor.removeCondition).
//  2. Zatruty na 0 Żywotności: po liczbie Rund równej BWt traci przytomność. Zatruty i nieprzytomny:
//     po kolejnych BWt Rundach Test Odporności — porażka oznacza śmierć. Po sukcesie kolejny test
//     wg ustawienia: po następnych BWt Rundach, w następnej Rundzie albo za 1 + PS Rund.
//
// Wyzwalacz: hook `updateCombat` (jak CombatHelpers w warhammer-lib), liczony tylko przez aktywnego
// MG. Zatrucie z triggerem „endRound" → koniec Rundy; „endTurn" (homebrew mooConditionTriggers)
// → koniec Tury danej postaci. Okno testu: karta z przyciskiem w czacie i/lub automatyczne
// otwarcie u właściciela postaci (przez socket modułu) — zależnie od ustawienia.

const MODULE_ID = "wfrp4e-bare-bones";
const SOCKET = `module.${MODULE_ID}`;
const S_ENABLED = "poisonEnabled";
const S_MODE = "poisonPromptMode";
const S_UNCONSCIOUS = "poisonUnconscious";
const S_DEATH_MODE = "poisonDeathMode";
const S_OVERFLOW = "poisonOverflowNoFatigue";
// flags.wfrp4e-bare-bones.poison = { zero, unc, due, tested: { test, heal, death } }
// `due` = po ilu Rundach nieprzytomności test o życie (0 = BWt).
const FLAG = "poison";

const loc = (k) => game.i18n.localize(k);
const fmt = (k, d) => game.i18n.format(k, d);

/* -------------------------------------------- */
/*  Ustawienia (świat, GM)                      */
/* -------------------------------------------- */
Hooks.once("init", () => {
  game.settings.register(MODULE_ID, S_ENABLED, {
    name: "PP.Poison.Enabled.Name",
    hint: "PP.Poison.Enabled.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });
  game.settings.register(MODULE_ID, S_MODE, {
    name: "PP.Poison.Mode.Name",
    hint: "PP.Poison.Mode.Hint",
    scope: "world",
    config: true,
    type: String,
    choices: {
      playersAuto: "PP.Poison.Mode.PlayersAuto",
      allAuto: "PP.Poison.Mode.AllAuto",
      buttonOnly: "PP.Poison.Mode.ButtonOnly",
    },
    default: "playersAuto",
  });
  game.settings.register(MODULE_ID, S_UNCONSCIOUS, {
    name: "PP.Poison.Unconscious.Name",
    hint: "PP.Poison.Unconscious.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });
  game.settings.register(MODULE_ID, S_DEATH_MODE, {
    name: "PP.Poison.DeathMode.Name",
    hint: "PP.Poison.DeathMode.Hint",
    scope: "world",
    config: true,
    type: String,
    choices: {
      tb: "PP.Poison.DeathMode.Tb",
      round: "PP.Poison.DeathMode.Round",
      sl: "PP.Poison.DeathMode.Sl",
    },
    default: "tb",
  });
  game.settings.register(MODULE_ID, S_OVERFLOW, {
    name: "PP.Poison.Overflow.Name",
    hint: "PP.Poison.Overflow.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  });
});

/* -------------------------------------------- */
/*  Pomocnicze                                  */
/* -------------------------------------------- */
function actorName(actor) {
  return actor?.token?.name || actor?.prototypeToken?.name || actor?.name || "?";
}

function poisonLevel(actor) {
  return Number(actor?.hasCondition?.("poisoned")?.conditionValue) || 0;
}

function toughnessBonus(actor) {
  return Math.max(1, Number(actor?.characteristics?.t?.bonus) || 1);
}

function getState(actor) {
  const s = actor?.getFlag?.(MODULE_ID, FLAG) ?? {};
  return { zero: Number(s.zero) || 0, unc: Number(s.unc) || 0, due: Number(s.due) || 0, tested: { ...(s.tested ?? {}) } };
}

/** Za ile Rund kolejny test o życie po udanym teście — wg ustawienia. */
function nextDeathDelay(sl, tb) {
  const mode = game.settings.get(MODULE_ID, S_DEATH_MODE);
  if (mode === "round") return 1;
  if (mode === "sl") return 1 + Math.max(0, Number(sl) || 0);
  return tb;
}

async function setState(actor, state) {
  await actor.setFlag(MODULE_ID, FLAG, state);
}

/** Aktywny gracz (nie-MG) będący właścicielem postaci; preferowany ten, którego to postać przypisana. */
function playerOwner(actor) {
  const users = game.users.filter((u) => u.active && !u.isGM && actor.testUserPermission(u, "OWNER"));
  return users.find((u) => u.character?.id === actor.id) ?? users[0] ?? null;
}

/** Odbiorcy kart: właściciele postaci (dla BN = tylko MG). */
function recipients(actor) {
  return game.users.filter((u) => u.isGM || actor.testUserPermission(u, "OWNER")).map((u) => u.id);
}

async function postCard(actor, html) {
  return ChatMessage.create({
    content: html,
    speaker: { alias: actorName(actor) },
    whisper: actor.hasPlayerOwner ? [] : recipients(actor),
  });
}

/* -------------------------------------------- */
/*  Testy                                       */
/* -------------------------------------------- */
/**
 * Test usuwający Zatrucie (kind "test" = Odporność samego zatrutego, "heal" = Leczenie wykonywane
 * przez `healer`) albo test śmierci (kind "death"). `key` = identyfikator końca Rundy/Tury, z którego
 * pochodzi prośba — ten sam test można wykonać raz na dany klucz.
 */
async function poisonTest(actor, { kind = "test", key = null, healer = null } = {}) {
  if (!actor) return;
  const level = poisonLevel(actor);
  if (kind !== "death" && level <= 0) return ui.notifications.info(fmt("PP.Poison.NotPoisoned", { name: actorName(actor) }));
  if (actor.hasCondition("dead")) return;

  const roller = kind === "heal" ? healer : actor;
  if (!roller) return ui.notifications.warn(loc("PP.Poison.NoHealer"));
  if (!roller.isOwner || !actor.isOwner && kind !== "heal") return ui.notifications.error(loc("PP.Poison.NotOwner"));

  const state = getState(actor);
  if (key && state.tested[kind] === key) return ui.notifications.info(loc("PP.Poison.AlreadyTested"));

  const skillName = loc(kind === "heal" ? "NAME.Heal" : "NAME.Endurance");
  const title = kind === "death" ? loc("PP.Poison.DeathTitle") : `${loc("WFRP4E.ConditionName.Poisoned")} (${actorName(actor)})`;
  const test = await roller.setupSkill(skillName, {
    appendTitle: ` - ${title}`,
    skipTargets: true,
    fields: { difficulty: "challenging" },
  });
  if (!test) return; // okno zamknięte bez rzutu
  await test.roll();

  // Zapis „już testowano" przez właściciela zatrutego (przy Leczeniu leczący może nie mieć praw — wtedy pomijamy).
  if (key && actor.isOwner) {
    state.tested[kind] = key;
    await setState(actor, state);
  }

  const name = actorName(actor);
  if (kind === "death") {
    if (test.failed) {
      await actor.addCondition("dead");
      return postCard(actor, `<p>${fmt("PP.Poison.DeathFailed", { name })}</p>`);
    }
    const next = nextDeathDelay(test.result.SL, toughnessBonus(actor));
    if (actor.isOwner) await setState(actor, { ...getState(actor), unc: 0, due: next });
    return postCard(actor, `<p>${fmt("PP.Poison.DeathSurvived", { name, n: next })}</p>`);
  }

  if (!test.succeeded) return postCard(actor, `<p>${fmt("PP.Poison.TestFailed", { name })}</p>`);
  const levels = 1 + Math.max(0, Number(test.result.SL) || 0);
  // Leczący bez praw do pacjenta → zdjęcie poziomów wykonuje aktywny MG.
  if (actor.isOwner) return removePoison(actor, levels);
  game.socket.emit(SOCKET, { action: "poisonRemove", actorUuid: actor.uuid, levels });
}

async function removePoison(actor, levels) {
  const current = poisonLevel(actor);
  if (current <= 0 || levels <= 0) return;
  const name = actorName(actor);
  // Opcja: nadwyżka PS zdejmuje Zatrucie bez Zmęczenia (Zmęczenie dodaje tylko removeCondition).
  if (levels > current && game.settings.get(MODULE_ID, S_OVERFLOW)) {
    await actor.hasCondition("poisoned")?.delete();
    return postCard(actor, `<p>${fmt("PP.Poison.CuredOverflow", { name, n: current })}</p>`);
  }
  // Nie więcej niż bieżący poziom — inaczej removeCondition zejdzie poniżej 0 i system pominie Zmęczenie.
  const removed = Math.min(current, levels);
  await actor.removeCondition("poisoned", removed);
  const left = current - removed;
  return postCard(actor, `<p>${fmt(left > 0 ? "PP.Poison.Reduced" : "PP.Poison.Cured", { name, n: removed, left })}</p>`);
}

/** Otwiera okno testu u właściwej osoby albo zostawia tylko przycisk — wg ustawienia. Wołane przez MG. */
function promptTest(actor, kind, key) {
  const mode = game.settings.get(MODULE_ID, S_MODE);
  if (mode === "buttonOnly") return;
  const player = playerOwner(actor);
  if (player) {
    game.socket.emit(SOCKET, { action: "poisonTest", userId: player.id, actorUuid: actor.uuid, kind, key });
  } else if (mode === "allAuto") {
    // Bez await — okna MG kolejkują się niezależnie od przetwarzania końca Rundy.
    queueLocal(() => poisonTest(actor, { kind, key }));
  }
}

let localQueue = Promise.resolve();
function queueLocal(fn) {
  localQueue = localQueue.then(fn).catch((e) => console.error(`${MODULE_ID} | zatrucie — błąd testu`, e));
}

/* -------------------------------------------- */
/*  Koniec Rundy / Tury                         */
/* -------------------------------------------- */
function button(kind, actor, key, label) {
  return `<a class="chat-button" data-pp-poison="${kind}" data-actor-uuid="${actor.uuid}" data-key="${key}">${label}</a>`;
}

/** Przetwarza jednego zatrutego aktora na koniec jego Rundy/Tury. Wołane tylko przez aktywnego MG. */
async function processActor(actor, key) {
  if (!actor || actor.hasCondition("dead")) return;
  const level = poisonLevel(actor);
  const state = getState(actor);

  if (level <= 0) {
    if (state.zero || state.unc || state.due) await setState(actor, { ...state, zero: 0, unc: 0, due: 0 });
    return;
  }

  const name = actorName(actor);
  const tb = toughnessBonus(actor);
  const notes = [];
  let deathTest = false;

  if (game.settings.get(MODULE_ID, S_UNCONSCIOUS)) {
    const wounds = Number(actor.status?.wounds?.value) || 0;
    if (actor.hasCondition("unconscious")) {
      state.zero = 0;
      state.unc += 1;
      const due = state.due || tb;
      if (state.unc >= due) {
        deathTest = true;
        notes.push(fmt("PP.Poison.DeathDue", { name }));
      } else {
        notes.push(fmt("PP.Poison.UncCounter", { n: state.unc, due }));
      }
    } else if (wounds <= 0) {
      state.unc = 0;
      state.due = 0;
      state.zero += 1;
      if (state.zero >= tb) {
        state.zero = 0;
        await actor.addCondition("unconscious");
        notes.push(fmt("PP.Poison.FellUnconscious", { name, tb }));
      } else {
        notes.push(fmt("PP.Poison.ZeroCounter", { n: state.zero, tb }));
      }
    } else {
      state.zero = 0;
      state.unc = 0;
      state.due = 0;
    }
  }
  await setState(actor, state);

  const heading = `${loc("WFRP4E.ConditionName.Poisoned")} ${level}`;
  let html = `<h2>${heading}</h2><p>${loc("PP.Poison.Reminder")}</p>`;
  if (notes.length) html += `<p><strong>${notes.join("<br>")}</strong></p>`;
  if (deathTest) html += button("death", actor, key, loc("PP.Poison.DeathButton"));
  html += button("test", actor, key, loc("PP.Poison.TestButton"));
  html += button("heal", actor, key, loc("PP.Poison.HealButton"));
  await postCard(actor, html);

  // Test śmierci ma pierwszeństwo — po nim właściciel i tak może kliknąć test zdejmujący Zatrucie.
  promptTest(actor, deathTest ? "death" : "test", key);
}

/** Ostatnio przetworzone końce Rund/Tur per walka — żeby cofnięcie i ponowny krok nie dublowały kart. */
const tracker = new Map();

function poisonTrigger(actor) {
  return actor?.hasCondition?.("poisoned")?.system?.condition?.trigger;
}

async function onUpdateCombat(combat, changed, options) {
  if (game.system?.id !== "wfrp4e") return;
  if (!game.users.activeGM?.isSelf) return;
  if (!game.settings.get(MODULE_ID, S_ENABLED)) return;
  if (options?.direction !== 1) return;
  if (!("round" in changed) && !("turn" in changed)) return;

  let t = tracker.get(combat.id);
  if (!t) tracker.set(combat.id, (t = { round: 0, turns: {} }));

  const jobs = []; // [actor, key]
  const seen = new Set();

  // Koniec Tury poprzedniej postaci (Zatrucie z triggerem endTurn).
  const prevId = combat.previous?.combatantId;
  const prev = prevId ? combat.combatants.get(prevId) : null;
  const prevRound = combat.previous?.round ?? combat.round;
  if (prev?.actor && poisonTrigger(prev.actor) === "endTurn" && (t.turns[prev.id] ?? 0) < prevRound) {
    t.turns[prev.id] = prevRound;
    jobs.push([prev.actor, `${combat.id}:${prevRound}:${prev.id}`]);
    seen.add(prev.actor.uuid);
  }

  // Koniec Rundy (Zatrucie z triggerem endRound).
  if ("round" in changed) {
    const ended = combat.round - 1;
    if (ended >= 1 && t.round < ended) {
      t.round = ended;
      for (const c of combat.combatants) {
        const a = c.actor;
        if (!a || seen.has(a.uuid) || poisonTrigger(a) !== "endRound") continue;
        seen.add(a.uuid);
        jobs.push([a, `${combat.id}:${ended}`]);
      }
    }
  }

  for (const [actor, key] of jobs) {
    try {
      await processActor(actor, key);
    } catch (e) {
      console.error(`${MODULE_ID} | zatrucie — błąd przetwarzania ${actorName(actor)}`, e);
    }
  }
}

Hooks.on("updateCombat", onUpdateCombat);
Hooks.on("deleteCombat", (combat) => tracker.delete(combat.id));

/* -------------------------------------------- */
/*  Przyciski w czacie + socket                 */
/* -------------------------------------------- */
/** Leczący: zaznaczony token klikającego (inny niż pacjent) albo jego przypisana postać. */
function pickHealer(patient) {
  const controlled = canvas?.tokens?.controlled?.map((t) => t.actor).filter((a) => a && a.uuid !== patient.uuid) ?? [];
  return controlled[0] ?? (game.user.character?.uuid !== patient.uuid ? game.user.character : null) ?? null;
}

async function onChatClick(ev) {
  const btn = ev.target?.closest?.("[data-pp-poison]");
  if (!btn) return;
  ev.preventDefault();
  ev.stopPropagation();
  const kind = btn.dataset.ppPoison;
  const actor = await fromUuid(btn.dataset.actorUuid);
  if (!actor) return ui.notifications.warn(loc("PP.Poison.NoActor"));
  const healer = kind === "heal" ? pickHealer(actor) : null;
  try {
    await poisonTest(actor, { kind, key: btn.dataset.key || null, healer });
  } catch (e) {
    console.error(`${MODULE_ID} | zatrucie — błąd testu`, e);
  }
}

Hooks.once("ready", () => {
  if (game.system?.id !== "wfrp4e") return;
  document.addEventListener("click", onChatClick, true);

  game.socket.on(SOCKET, async (data) => {
    if (data?.action === "poisonTest" && data.userId === game.user.id) {
      const actor = await fromUuid(data.actorUuid);
      if (actor) queueLocal(() => poisonTest(actor, { kind: data.kind, key: data.key }));
    } else if (data?.action === "poisonRemove" && game.users.activeGM?.isSelf) {
      const actor = await fromUuid(data.actorUuid);
      if (actor) await removePoison(actor, Number(data.levels) || 0);
    }
  });

  const mod = game.modules.get(MODULE_ID);
  if (mod) mod.api = Object.assign(mod.api ?? {}, { poisonTest });
});
