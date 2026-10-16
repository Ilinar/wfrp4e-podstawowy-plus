// WFRP4e: Sieczna (X) — część modułu „Podstawowy+" (reguła z „Do broni!").
//
// System (wfrp4e 9.5) przy Ranie Krytycznej zadanej bronią Sieczną tylko wypisuje tekst
// (PROPERTY.SlashAlert) i niczego nie nadaje. Ta reguła dokłada:
//
//  1. Gdy broń z cechą Sieczna zada Ranę Krytyczną (krytyk w rzucie ataku albo obrażenia do 0
//     Żywotności), ofiara otrzymuje 1 poziom Krwawienia, a w czacie pojawia się karta.
//  2. Na karcie przycisk: atakujący wydaje X Przewag → przeciwnik otrzymuje dodatkowy 1 poziom
//     Krwawienia (raz na trafienie). Wydanie wykonuje MG (gracz → socket do aktywnego MG), bo
//     gracz zwykle nie ma praw do postaci przeciwnika.
//
// Wyzwalacz: hook `wfrp4e:applyDamage` (Hooks.call, bez await) u klienta stosującego obrażenia —
// ten jest właścicielem obrońcy. Handler jest synchroniczny i nigdy nie zwraca `false`.
// Karta jest osobną wiadomością (nie `extraMessages`), bo ścieżka „Zastosuj obrażenia" z menu
// kontekstowego w systemie nie wypisuje `extraMessages` do czatu.

const MODULE_ID = "wfrp4e-bare-bones";
const SOCKET = `module.${MODULE_ID}`;
const S_ENABLED = "slashEnabled";
const S_ADVANTAGE = "slashAdvantage";
const FLAG = "slash"; // flags.wfrp4e-bare-bones.slash = { attacker, defender, cost, used }

const loc = (k) => game.i18n.localize(k);
const fmt = (k, d) => game.i18n.format(k, d);

/* -------------------------------------------- */
/*  Ustawienia (świat, GM)                      */
/* -------------------------------------------- */
Hooks.once("init", () => {
  game.settings.register(MODULE_ID, S_ENABLED, {
    name: "PP.Slash.Enabled.Name",
    hint: "PP.Slash.Enabled.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });
  game.settings.register(MODULE_ID, S_ADVANTAGE, {
    name: "PP.Slash.Advantage.Name",
    hint: "PP.Slash.Advantage.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });
});

// Cecha Sieczna bez modułu „Do broni!" (Up in Arms dopisuje ją w `init`, więc tu już jest, jeśli działa).
Hooks.once("setup", () => {
  const cfg = game.wfrp4e?.config;
  if (!cfg?.weaponQualities || cfg.weaponQualities.slash) return;
  cfg.weaponQualities.slash = loc("PP.Slash.Name");
  if (cfg.qualityDescriptions) cfg.qualityDescriptions.slash = loc("PP.Slash.Description");
  if (cfg.propertyHasValue) cfg.propertyHasValue.slash = true;
});

/* -------------------------------------------- */
/*  Pomocnicze                                  */
/* -------------------------------------------- */
function actorName(actor) {
  return actor?.token?.name || actor?.prototypeToken?.name || actor?.name || "?";
}

/** Wartość X cechy Sieczna albo null, gdy broń jej nie ma (lub postać nie ma umiejętności broni). */
function slashValue(item) {
  const q = item?.properties?.qualities?.slash;
  if (!q) return null;
  return Math.max(0, parseInt(q.value) || 0);
}

/** Czy trafienie zadaje Ranę Krytyczną: krytyk w rzucie ataku albo obrażenia do 0 Żywotności. */
function isCritical(args) {
  const ot = args.opposedTest;
  const at = ot?.attackerTest;
  const rollCrit = ot?.result?.winner === "attacker" && !!at?.result?.critical && !at?.result?.tables?.critical?.nulled;
  // Ten sam warunek, przy którym system dodaje link „Rana Krytyczna" do wiadomości o obrażeniach.
  const wounds = Number(args.actor?.status?.wounds?.value) || 0;
  const woundCrit = wounds - (Number(args.totalWoundLoss) || 0) <= 0;
  return rollCrit || woundCrit;
}

/* -------------------------------------------- */
/*  Rana Krytyczna → Krwawienie + karta         */
/* -------------------------------------------- */
async function postSlashCard(attacker, defender, x) {
  const withButton = x > 0 && !!attacker && game.settings.get(MODULE_ID, S_ADVANTAGE);
  let content = `<h2>${fmt("PP.Slash.Title", { x })}</h2><p>${fmt("PP.Slash.Bleed", { name: actorName(defender) })}</p>`;
  if (withButton) {
    content += `<div class="pp-slash-action"><a class="chat-button" data-pp-slash="spend">${fmt("PP.Slash.Button", { x })}</a></div>`;
  }
  return ChatMessage.create({
    content,
    speaker: { alias: actorName(attacker ?? defender) },
    flags: withButton
      ? { [MODULE_ID]: { [FLAG]: { attacker: attacker.uuid, defender: defender.uuid, cost: x, used: false } } }
      : {},
  });
}

function onApplyDamage(args) {
  try {
    if (game.system?.id !== "wfrp4e") return;
    if (!game.settings.get(MODULE_ID, S_ENABLED)) return;
    const ot = args?.opposedTest;
    if (!ot || args.abort) return; // tylko trafienia z testu przeciwstawnego (nie Krwawienie, Zatrucie itd.)
    if (args.ward > 0 && args.wardRoll >= args.ward) return; // Ward — obrażenia i tak przepadną
    const x = slashValue(ot.attackerTest?.item ?? args.sourceItem);
    if (x === null || !isCritical(args)) return;

    const defender = args.actor;
    const attacker = args.attacker ?? ot.attacker;
    Promise.resolve(defender.addCondition("bleeding", 1)).catch((e) =>
      console.error(`${MODULE_ID} | sieczna — błąd nadawania Krwawienia`, e)
    );
    postSlashCard(attacker, defender, x).catch((e) => console.error(`${MODULE_ID} | sieczna — błąd karty`, e));
  } catch (e) {
    console.error(`${MODULE_ID} | sieczna — błąd`, e);
  }
}

Hooks.on("wfrp4e:applyDamage", onApplyDamage);

/* -------------------------------------------- */
/*  Przycisk: wydanie X Przewag                 */
/* -------------------------------------------- */
/** Sprawdza, czy `user` może wydać Przewagi z karty. Zwraca { error } albo { data, attacker, defender }. */
async function checkSpend(message, user) {
  const data = message?.getFlag(MODULE_ID, FLAG);
  if (!data) return { error: loc("PP.Slash.NoActor") };
  if (data.used) return { error: loc("PP.Slash.Used") };
  const attacker = await fromUuid(data.attacker);
  const defender = await fromUuid(data.defender);
  if (!attacker || !defender) return { error: loc("PP.Slash.NoActor") };
  if (!user?.isGM && !attacker.testUserPermission(user, "OWNER")) return { error: loc("PP.Slash.NotOwner") };
  const have = Number(attacker.status?.advantage?.value) || 0;
  if (have < data.cost) {
    return { error: fmt("PP.Slash.NoAdvantage", { name: actorName(attacker), have, need: data.cost }) };
  }
  return { data, attacker, defender };
}

function notify(userId, text) {
  if (userId === game.user.id) ui.notifications.warn(text);
  else game.socket.emit(SOCKET, { action: "slashNotice", userId, text });
}

/** Wydanie Przewag + Krwawienie. Wykonuje MG (lokalnie albo na prośbę gracza przez socket). */
const pending = new Set();
async function applySlashSpend(messageId, userId) {
  if (pending.has(messageId)) return;
  pending.add(messageId);
  try {
    const message = game.messages.get(messageId);
    const user = game.users.get(userId);
    const r = await checkSpend(message, user);
    if (r.error) return notify(userId, r.error);
    const { data, attacker, defender } = r;

    const spent = `<p>${fmt("PP.Slash.Spent", { attacker: actorName(attacker), defender: actorName(defender), x: data.cost })}</p>`;
    await message.update({
      content: message.content.replace(/<div class="pp-slash-action">[\s\S]*?<\/div>/, spent),
      [`flags.${MODULE_ID}.${FLAG}.used`]: true,
    });
    await attacker.modifyAdvantage(-data.cost);
    await defender.addCondition("bleeding", 1);
  } finally {
    pending.delete(messageId);
  }
}

async function onChatClick(ev) {
  const btn = ev.target?.closest?.("[data-pp-slash]");
  if (!btn) return;
  ev.preventDefault();
  ev.stopPropagation();
  const message = game.messages.get(btn.closest("[data-message-id]")?.dataset.messageId);
  if (!message) return;
  try {
    const r = await checkSpend(message, game.user);
    if (r.error) return ui.notifications.warn(r.error);
    if (game.user.isGM) return await applySlashSpend(message.id, game.user.id);
    if (!game.users.activeGM) return ui.notifications.warn(loc("PP.Slash.NoGM"));
    game.socket.emit(SOCKET, { action: "slashSpend", messageId: message.id, userId: game.user.id });
  } catch (e) {
    console.error(`${MODULE_ID} | sieczna — błąd wydawania Przewag`, e);
  }
}

Hooks.once("ready", () => {
  if (game.system?.id !== "wfrp4e") return;
  document.addEventListener("click", onChatClick, true);

  game.socket.on(SOCKET, (data) => {
    if (data?.action === "slashSpend" && game.users.activeGM?.isSelf) {
      applySlashSpend(data.messageId, data.userId).catch((e) =>
        console.error(`${MODULE_ID} | sieczna — błąd wydawania Przewag`, e)
      );
    } else if (data?.action === "slashNotice" && data.userId === game.user.id) {
      ui.notifications.warn(data.text);
    }
  });
});
