// WFRP4e: Daj kasę (/give) — część modułu „Podstawowy+".
//
// Systemowe /credit (karta w czacie z przyciskami „Otrzymaj", podział na części) jest tylko dla MG
// i daje pieniądze „z niczego". /give robi to samo dla gracza z jego własnej sakiewki:
//
//   /give 30zk split=3 reason=Łup
//
// Kwota schodzi z przypisanej postaci gracza, a w czacie pojawia się systemowa karta „credit”
// z N równymi częściami. Odbieranie obsługuje system: przycisk dodaje monety postaci klikającego,
// a unikalny MG oznacza część jako odebraną (MoneyModel._onUpdate → CreditMessageModel.updateMessage).
// Dlatego /give wymaga aktywnego MG.
//
// Kartę budujemy sami (jak CreditMessageModel.createCreditMessage), bo systemowy podział zaokrągla
// resztę w górę (+1 p) — rozdający oddałby więcej, niż zapłacił. Tu część = floor(kwota / N),
// a reszta zostaje u rozdającego. Rozdający nie widzi przycisków na własnej karcie.

const MODULE_ID = "wfrp4e-bare-bones";
const S_ENABLED = "giveEnabled";
const FLAG = "give"; // flags.wfrp4e-bare-bones.give = { giverUser, giverActor, total }
const TEMPLATE = "systems/wfrp4e/templates/chat/market/market-credit.hbs";

const loc = (k) => game.i18n.localize(k);
const fmt = (k, d) => game.i18n.format(k, d);

/* -------------------------------------------- */
/*  Ustawienia (świat, GM)                      */
/* -------------------------------------------- */
Hooks.once("init", () => {
  game.settings.register(MODULE_ID, S_ENABLED, {
    name: "PP.Give.Enabled.Name",
    hint: "PP.Give.Enabled.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });
});

/* -------------------------------------------- */
/*  Pomocnicze                                  */
/* -------------------------------------------- */
const toBP = (m) => (m.gc || 0) * 240 + (m.ss || 0) * 12 + (m.bp || 0);

/** Przykład z lokalnymi skrótami monet (np. „30zk”). */
function example() {
  const gc = loc("MARKET.Abbrev.GC").toLowerCase();
  return fmt("PP.Give.Example", { amount: `30${gc}` });
}

/* -------------------------------------------- */
/*  /give                                       */
/* -------------------------------------------- */
async function handleGive(amount, split, reason) {
  if (!game.settings.get(MODULE_ID, S_ENABLED)) return ui.notifications.warn(loc("PP.Give.Disabled"));
  const market = game.wfrp4e.market;
  const actor = game.user.character;
  if (!actor) return ui.notifications.warn(loc("PP.Give.NoCharacter"));
  if (!game.users.activeGM) return ui.notifications.warn(loc("PP.Give.NoGM"));

  const parsed = amount ? market.parseMoneyTransactionString(amount) : false;
  if (!parsed) return ui.notifications.warn(`${loc("PP.Give.BadAmount")} ${example()}`);

  const n = Math.max(1, parseInt(split) || 1);
  const total = toBP(parsed);
  const share = Math.floor(total / n);
  if (share <= 0) return ui.notifications.warn(fmt("PP.Give.TooSmall", { n }));
  const cost = share * n;

  // Zapłata z sakiewki postaci (system sam sprawdza, czy starczy, i rozmienia monety).
  const items = market.payCommand(market.amountToString(market.makeSomeChange(cost, 0)), actor, { suppressMessage: true });
  if (!items) return;
  await actor.updateEmbeddedDocuments("Item", items);
  if (cost < total) {
    ui.notifications.info(fmt("PP.Give.Remainder", { rest: market.amountToString(market.makeSomeChange(total - cost, 0)) }));
  }

  const shareObj = market.makeSomeChange(share, 0);
  const splits = new Array(n).fill("");
  const content = await foundry.applications.handlebars.renderTemplate(TEMPLATE, { ...shareObj, splits });
  const flavor = fmt(n > 1 ? "PP.Give.FlavorSplit" : "PP.Give.Flavor", {
    name: actor.name,
    total: market.amountToString(market.makeSomeChange(cost, 0)),
    share: market.amountToString(shareObj),
    n,
  });

  await ChatMessage.create({
    type: "credit",
    system: { payString: market.amountToString(shareObj), splits, reason },
    content,
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: reason ? `${flavor} — ${Handlebars.escapeExpression(reason)}` : flavor,
    flags: { [MODULE_ID]: { [FLAG]: { giverUser: game.user.id, giverActor: actor.uuid, total: cost } } },
  });
}

Hooks.once("ready", () => {
  if (game.system?.id !== "wfrp4e" || !game.wfrp4e?.commands) return;
  game.wfrp4e.commands.add({
    give: {
      description: loc("PP.Give.CommandDescription"),
      notes: loc("PP.Give.CommandNotes"),
      args: ["amount", "split", "reason"],
      defaultArg: "amount",
      examples: `<br><span style="font-family: monospace">${example()}</span>`,
      callback: (amount, split, reason) =>
        handleGive(amount, split, reason).catch((e) => console.error(`${MODULE_ID} | give — błąd`, e)),
    },
  });
});

/* -------------------------------------------- */
/*  Rozdający nie odbiera własnych części       */
/* -------------------------------------------- */
function hideOwnButtons(message, html) {
  if (message.getFlag(MODULE_ID, FLAG)?.giverUser !== game.user.id) return;
  html.querySelectorAll('[data-action="receive"]').forEach((b) => b.remove());
}

Hooks.once("init", () => {
  if ((game.release?.generation ?? 13) >= 13) {
    Hooks.on("renderChatMessageHTML", (message, html) => hideOwnButtons(message, html));
  } else {
    Hooks.on("renderChatMessage", (message, html) => hideOwnButtons(message, html[0] ?? html));
  }
});
