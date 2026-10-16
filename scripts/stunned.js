// WFRP4e: Oszołomienie — część modułu „Podstawowy+".
//
// Polska definicja Stanu (core-pl) ma tylko karę do testów. Ta reguła dokłada:
//
//  1. Na początku Tury oszołomionej postaci (w walce) przypomnienie, że nie może wykonywać Akcji:
//     karta w czacie i/lub wyskakujące powiadomienie u gracza-właściciela (BN: u MG) — wg ustawienia.
//  2. Pod koniec każdej Rundy Wymagający (+0) Test Odporności: sukces zdejmuje 1 poziom + 1 za każdy
//     PS; po zdjęciu wszystkich poziomów system sam dodaje Zmęczenie (jeśli postać go nie ma).
//     Opcja: nadwyżka PS (1 + PS > poziom) zdejmuje Stan bez Zmęczenia — jak test w systemie.
//     Angielska definicja z systemu ma własny test (skrypt `endRound`) — wtedy go nie dublujemy.
//
// Wyzwalacz: hook `updateCombat` liczony tylko przez aktywnego MG — krok do przodu (direction 1)
// albo start walki (warhammer-lib nie odpala startTurn dla pierwszej Tury walki). Kolejność jak
// w systemie: najpierw koniec Rundy, potem początek Tury. Jeśli pierwsza postać nowej Rundy właśnie
// dostała okno testu, przypomnienie wysyła się dopiero po teście (o ile nadal jest Oszołomiona).

const MODULE_ID = "wfrp4e-bare-bones";
const SOCKET = `module.${MODULE_ID}`;
const S_MODE = "stunnedReminder";
const S_TEST = "stunnedTestMode";
const S_OVERFLOW = "stunnedOverflowNoFatigue";
const FLAG = "stunned"; // flags.wfrp4e-bare-bones.stunned = { tested } — klucz końca Rundy z wykonanym testem

const loc = (k) => game.i18n.localize(k);
const fmt = (k, d) => game.i18n.format(k, d);

/* -------------------------------------------- */
/*  Ustawienia (świat, GM)                      */
/* -------------------------------------------- */
Hooks.once("init", () => {
  game.settings.register(MODULE_ID, S_MODE, {
    name: "PP.Stunned.Mode.Name",
    hint: "PP.Stunned.Mode.Hint",
    scope: "world",
    config: true,
    type: String,
    choices: {
      both: "PP.Stunned.Mode.Both",
      chat: "PP.Stunned.Mode.Chat",
      popup: "PP.Stunned.Mode.Popup",
      off: "PP.Stunned.Mode.Off",
    },
    default: "both",
  });
  game.settings.register(MODULE_ID, S_TEST, {
    name: "PP.Stunned.Test.Name",
    hint: "PP.Stunned.Test.Hint",
    scope: "world",
    config: true,
    type: String,
    choices: {
      playersAuto: "PP.Stunned.Test.PlayersAuto",
      allAuto: "PP.Stunned.Test.AllAuto",
      buttonOnly: "PP.Stunned.Test.ButtonOnly",
      off: "PP.Stunned.Test.Off",
    },
    default: "playersAuto",
  });
  game.settings.register(MODULE_ID, S_OVERFLOW, {
    name: "PP.Stunned.Overflow.Name",
    hint: "PP.Stunned.Overflow.Hint",
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

function stunLevel(actor) {
  return Number(actor?.hasCondition?.("stunned")?.conditionValue) || 0;
}

/** Czy aktywna definicja Stanu sama prosi o test na koniec Rundy (angielska z systemu). */
function systemHandlesTest(actor) {
  const scripts = actor?.hasCondition?.("stunned")?.system?.scriptData ?? [];
  return scripts.some((s) => s?.trigger === "endRound");
}

/** Aktywni gracze (nie-MG) będący właścicielami postaci. */
function playerOwners(actor) {
  return game.users.filter((u) => u.active && !u.isGM && actor.testUserPermission(u, "OWNER"));
}

/** Gracz, któremu otworzyć okno testu: preferowany ten, którego to postać przypisana. */
function playerOwner(actor) {
  const users = playerOwners(actor);
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

let localQueue = Promise.resolve();
function queueLocal(fn) {
  localQueue = localQueue.then(fn).catch((e) => console.error(`${MODULE_ID} | oszołomienie — błąd testu`, e));
}

/* -------------------------------------------- */
/*  Przypomnienie na początku Tury              */
/* -------------------------------------------- */
async function remind(actor) {
  const mode = game.settings.get(MODULE_ID, S_MODE);
  if (mode === "off") return;
  const name = actorName(actor);

  if (mode === "both" || mode === "chat") {
    await postCard(actor, `<h2>${fmt("PP.Stunned.Title", { n: stunLevel(actor) || 1 })}</h2><p>${fmt("PP.Stunned.Card", { name })}</p>`);
  }
  if (mode === "both" || mode === "popup") {
    // Postać gracza → popup u graczy-właścicieli; BN (albo nikogo z graczy online) → u wołającego (MG).
    const ids = playerOwners(actor).map((u) => u.id);
    const others = ids.filter((id) => id !== game.user.id);
    if (!ids.length || ids.includes(game.user.id)) ui.notifications.warn(fmt("PP.Stunned.Popup", { name }));
    if (others.length) game.socket.emit(SOCKET, { action: "stunnedNotify", userIds: others, name });
  }
}

/* -------------------------------------------- */
/*  Test Odporności na koniec Rundy             */
/* -------------------------------------------- */
/** Test zdejmujący Oszołomienie. `key` = koniec Rundy, z którego pochodzi prośba (jeden test na klucz). */
async function stunTest(actor, { key = null } = {}) {
  if (!actor) return;
  const name = actorName(actor);
  if (stunLevel(actor) <= 0) return ui.notifications.info(fmt("PP.Stunned.NotStunned", { name }));
  if (actor.hasCondition("dead")) return;
  if (!actor.isOwner) return ui.notifications.error(loc("PP.Stunned.NotOwner"));
  if (key && actor.getFlag(MODULE_ID, FLAG)?.tested === key) return ui.notifications.info(loc("PP.Stunned.AlreadyTested"));

  const test = await actor.setupSkill(loc("NAME.Endurance"), {
    appendTitle: ` - ${loc("PP.Stunned.Name")}`,
    skipTargets: true,
    fields: { difficulty: "challenging" },
  });
  if (!test) return; // okno zamknięte bez rzutu
  await test.roll();
  if (key) await actor.setFlag(MODULE_ID, FLAG, { tested: key });

  if (!test.succeeded) return postCard(actor, `<p>${fmt("PP.Stunned.TestFailed", { name })}</p>`);
  const current = stunLevel(actor);
  const wanted = 1 + Math.max(0, Number(test.result.SL) || 0);
  if (current <= 0) return;
  // Opcja: nadwyżka PS zdejmuje Stan bez Zmęczenia (Zmęczenie dodaje tylko removeCondition).
  if (wanted > current && game.settings.get(MODULE_ID, S_OVERFLOW)) {
    await actor.hasCondition("stunned")?.delete();
    return postCard(actor, `<p>${fmt("PP.Stunned.CuredOverflow", { name, n: current })}</p>`);
  }
  // Nie więcej niż bieżący poziom — inaczej removeCondition zejdzie poniżej 0 i system pominie Zmęczenie.
  const removed = Math.min(current, wanted);
  const hadFatigue = !!actor.hasCondition("fatigued");
  await actor.removeCondition("stunned", removed);
  const left = current - removed;
  const msg = left > 0 ? "PP.Stunned.Reduced" : hadFatigue ? "PP.Stunned.CuredNoFatigue" : "PP.Stunned.Cured";
  return postCard(actor, `<p>${fmt(msg, { name, n: removed, left })}</p>`);
}

/** Test, a po nim (jeśli to Tura tej postaci) przypomnienie — o ile Oszołomienie nadal trwa. */
async function stunTestThen(actor, key, remindAfter) {
  try {
    await stunTest(actor, { key });
  } finally {
    if (remindAfter && stunLevel(actor) > 0 && !actor.hasCondition("dead")) await remind(actor);
  }
}

function testButton(actor, key) {
  return `<a class="chat-button" data-pp-stunned="test" data-actor-uuid="${actor.uuid}" data-key="${key}">${loc("PP.Stunned.TestButton")}</a>`;
}

/**
 * Karta końca Rundy + okno testu wg ustawienia. Wołane przez MG. Zwraca true, gdy okno testu
 * otworzy się samo i to ono wyśle przypomnienie na początek Tury (`remindAfter`).
 */
async function endRoundTest(actor, key, remindAfter) {
  const mode = game.settings.get(MODULE_ID, S_TEST);
  if (mode === "off" || !actor || actor.hasCondition("dead")) return false;
  const level = stunLevel(actor);
  if (level <= 0 || systemHandlesTest(actor)) return false;

  await postCard(actor, `<h2>${fmt("PP.Stunned.Title", { n: level })}</h2><p>${loc("PP.Stunned.EndRound")}</p>${testButton(actor, key)}`);
  if (mode === "buttonOnly") return false;

  const remindLater = remindAfter && game.settings.get(MODULE_ID, S_MODE) !== "off";
  const player = playerOwner(actor);
  if (player) {
    game.socket.emit(SOCKET, { action: "stunnedTest", userId: player.id, actorUuid: actor.uuid, key, remind: remindLater });
    return remindLater;
  }
  if (mode === "allAuto") {
    // Bez await — okna MG kolejkują się niezależnie od przetwarzania końca Rundy.
    queueLocal(() => stunTestThen(actor, key, remindLater));
    return remindLater;
  }
  return false;
}

/* -------------------------------------------- */
/*  Walka                                       */
/* -------------------------------------------- */
/** Per walka: ostatnio przetworzony koniec Rundy i Runda przypomnienia per walczący (bez duplikatów). */
const tracker = new Map();

async function onUpdateCombat(combat, changed, options) {
  if (game.system?.id !== "wfrp4e") return;
  if (!game.users.activeGM?.isSelf) return;
  if (!("round" in changed) && !("turn" in changed)) return;
  const forward = options?.direction === 1;
  const started = changed.round === 1 && (combat.previous?.round ?? 0) === 0;
  if (!forward && !started) return;

  let t = tracker.get(combat.id);
  if (!t) tracker.set(combat.id, (t = { round: 0, turns: {} }));
  const current = combat.combatant;

  // 1. Koniec Rundy — Test Odporności.
  const deferred = new Set(); // aktorzy, którym przypomnienie wyśle okno testu
  if (forward && "round" in changed) {
    const ended = combat.round - 1;
    if (ended >= 1 && t.round < ended) {
      t.round = ended;
      const seen = new Set();
      for (const c of combat.combatants ?? []) {
        const a = c.actor;
        if (!a || c.isDefeated || seen.has(a.uuid)) continue;
        seen.add(a.uuid);
        try {
          if (await endRoundTest(a, `${combat.id}:${ended}`, a === current?.actor)) deferred.add(a.uuid);
        } catch (e) {
          console.error(`${MODULE_ID} | oszołomienie — błąd końca Rundy ${actorName(a)}`, e);
        }
      }
    }
  }

  // 2. Początek Tury — przypomnienie o braku Akcji.
  const actor = current?.actor;
  if (!actor || current.isDefeated || actor.hasCondition("dead") || stunLevel(actor) <= 0) return;
  if ((t.turns[current.id] ?? 0) >= combat.round) return;
  t.turns[current.id] = combat.round;
  if (deferred.has(actor.uuid)) return;
  try {
    await remind(actor);
  } catch (e) {
    console.error(`${MODULE_ID} | oszołomienie — błąd przypomnienia`, e);
  }
}

Hooks.on("updateCombat", onUpdateCombat);
Hooks.on("deleteCombat", (combat) => tracker.delete(combat.id));

/* -------------------------------------------- */
/*  Przycisk w czacie + socket                  */
/* -------------------------------------------- */
async function onChatClick(ev) {
  const btn = ev.target?.closest?.("[data-pp-stunned]");
  if (!btn) return;
  ev.preventDefault();
  ev.stopPropagation();
  const actor = await fromUuid(btn.dataset.actorUuid);
  if (!actor) return ui.notifications.warn(loc("PP.Stunned.NoActor"));
  try {
    await stunTest(actor, { key: btn.dataset.key || null });
  } catch (e) {
    console.error(`${MODULE_ID} | oszołomienie — błąd testu`, e);
  }
}

Hooks.once("ready", () => {
  if (game.system?.id !== "wfrp4e") return;
  document.addEventListener("click", onChatClick, true);

  game.socket.on(SOCKET, async (data) => {
    if (data?.action === "stunnedNotify" && data.userIds?.includes(game.user.id)) {
      ui.notifications.warn(fmt("PP.Stunned.Popup", { name: data.name }));
    } else if (data?.action === "stunnedTest" && data.userId === game.user.id) {
      const actor = await fromUuid(data.actorUuid);
      if (actor) queueLocal(() => stunTestThen(actor, data.key, !!data.remind));
    }
  });

  const mod = game.modules.get(MODULE_ID);
  if (mod) mod.api = Object.assign(mod.api ?? {}, { stunTest });
});
