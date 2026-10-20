# WFRP4e: Podstawowy+

Zbiór **reguł domowych z podręcznika podstawowego** do **Warhammer Fantasy Roleplay 4e**
(Foundry VTT). Każdą regułę można włączać/stosować niezależnie. Nie wymaga `lib-wrapper`.

Obecnie moduł zawiera sześć reguł:

1. **Same Kości** — koścista natura szkieletów,
2. **Praktyczne narzędzia** — premia do testów Rzemiosła praktycznym narzędziem,
3. **Zatrucie** — test Odporności na koniec Rundy oraz utrata przytomności i śmierć po BWt Rundach,
4. **Oszołomienie** — przypomnienie na początku Tury o braku Akcji i Test Odporności na koniec Rundy,
5. **Sieczna** (z „Do broni!”) — Krwawienie przy Ranie Krytycznej i dodatkowe Krwawienie za Przewagi,
6. **Talent Artystyczny** — Sztuka w każdej Profesji albo −5 PD za Rozwinięcie.

Do tego narzędzie **Daj kasę** (`/give`): gracz rozdaje pieniądze ze swojej postaci przez czat.

Moduł dostarcza jedno kompendium **„Podstawowy+ (WFRP4e)”** z gotową cechą
**„Same Kości”** oraz gotowym przedmiotem **„Praktyczne narzędzia pracy (Rzemiosło dowolne)”**.

---

## Instalacja

W Foundry: **Setup → Moduły dodatkowe → Zainstaluj moduł**, w polu *Adres URL manifestu* wklej:

```
https://github.com/Ilinar/wfrp4e-podstawowy-plus/releases/latest/download/module.json
```

Nowe wersje pojawiają się potem przy **Sprawdź aktualizacje** na liście modułów.

## Reguła 1 — Same Kości (koścista natura szkieletów)

> Aby oddać kościstą naturę szkieletów, ataki **bez cechy Ogłuszająca** zadają oznaczonemu
> stworzeniu **-1 punkt Obrażeń do Ran**.

W systemie WFRP4e cecha **„Ogłuszająca” to cecha _Pummel_** (broń obuchowa: maczugi, młoty,
kiścienie itp.). Atak z tą cechą zadaje szkieletom **pełne** obrażenia; każdy inny atak — **-1**.

### Jak używać

1. Otwórz **Kompendia** → **„Podstawowy+ (WFRP4e)”**.
2. **Przeciągnij** cechę **„Same Kości”** na kartę (statblok) stworzenia.

To wszystko. Cecha jest **samodzielna** — działa jak talent **Krzepki**: niesie własny skrypt,
który przy obrażeniach odejmuje 1 punkt Ran (do zera), o ile atak nie ma cechy Ogłuszająca
(Pummel). W rozbiciu obrażeń pojawia się pozycja „Same Kości −1”. Żeby wyłączyć regułę dla
stworzenia — usuń z niego cechę.

### Szczegóły

- Kara dotyczy obrażeń od **broni** oraz **naturalnych ataków stworzeń** (cech) — magia/zaklęcia
  bez kary.
- Wyjątek: atak z cechą **Ogłuszająca (Pummel)** → pełne obrażenia.
- Kara może zmniejszyć Rany z trafienia aż do **0** (cios ześlizguje się po kościach).

---

## Reguła 2 — Praktyczne narzędzia (Rzemiosło)

Zgodnie z opisem cechy **Praktyczny** („Nieudany Test z użyciem tego przedmiotu otrzymuje
+1 PS”), reguła rozszerza ten efekt na **testy Rzemiosła**:

> Przy **nieudanym** teście **Rzemiosła** wykonanym, gdy postać posiada **praktyczne narzędzie
> rzemieślnicze** pasujące do specjalizacji testu, wynik otrzymuje **+1 PS**.

System stosuje cechę Praktyczny tylko do broni i pancerza; ta reguła uzupełnia ją dla narzędzi.

### Jak działa dopasowanie

Narzędzie liczy się do bonusu, gdy spełnia wszystko naraz:

- jest typu **„Narzędzia i zestawy”** (lub „Narzędzia rzemieślnicze”),
- ma cechę **Praktyczny**,
- jego **nazwa zawiera w nawiasie specjalizację** zgodną ze specjalizacją testu, np.
  narzędzie *„Dłuta i strugi (Stolarstwo)”* dla testu *Rzemiosło (Stolarstwo)*.

**Uniwersalne narzędzie:** nawias **„(Rzemiosło dowolne)”** (albo `(dowolne)` / `(any)` / `(*)`)
pasuje do **każdej** specjalizacji Rzemiosła.

> Samo dodanie cechy Praktyczny do zwykłego narzędzia **nie wystarczy** — potrzebna jest
> pasująca specjalizacja w nazwie (albo dopisek uniwersalny).

### Gotowy przedmiot

W kompendium znajdziesz gotowy, uniwersalny przedmiot **„Praktyczne narzędzia pracy
(Rzemiosło dowolne)”** (cena 6 zk, dostępność egzotyczna, cecha Praktyczny). Przeciągnij go na
postać, aby od razu korzystać z bonusu przy dowolnym Rzemiośle.

Przy zadziałaniu reguły na karcie testu pojawia się notka „Praktyczne narzędzie (…): +1 PS”.

### Ustawienie

- **Praktyczne narzędzia: bonus do Rzemiosła** (świat, domyślnie włączone) — pozwala wyłączyć regułę.

---

## Reguła 3 — Zatrucie

System na koniec Rundy daje tylko przycisk „Zastosuj Zatrucie” (obrażenia). Ta reguła dokłada
resztę zasad z podręcznika:

> Pod koniec każdej Rundy postać może wykonać **Test Odporności**. Sukces zmniejsza Zatrucie
> o 1 poziom, a każdy PS o dodatkowy poziom. **Test Leczenia** skutkuje tym samym. Po usunięciu
> wszystkich poziomów postać otrzymuje **Zmęczenie**.

Na koniec Rundy, w trakcie walki, każda zatruta postać dostaje w czacie kartę z przyciskami:

- **Test Odporności (Zatrucie)** — Wymagający (+0); kara −10 za każdy poziom Zatrucia dolicza się
  sama w oknie testu (tak działa stan w systemie),
- **Test Leczenia (zaznaczona postać)** — test wykonuje postać, której token masz zaznaczony
  (albo Twoja przypisana postać).

Każdy z tych testów można wykonać raz na Rundę. Jeśli system liczy Zatrucie na **Tury** (homebrew
„Condition Triggers” z MOO), karta pojawia się na koniec Tury danej postaci.

### Utrata przytomności i śmierć (BWt)

- Zatruta postać na **0 Żywotności** — po liczbie Rund równej **BWt** traci przytomność
  (moduł sam nadaje stan Utrata Przytomności). Na karcie widać licznik, np. „Runda 2/3”.
- Zatruta i **nieprzytomna** — po kolejnych **BWt** Rundach wykonuje **Test Odporności**.
  Porażka: stan **Martwy**. Sukces: kolejny test wg ustawienia „kolejne testy o życie”
  (domyślnie po następnych BWt Rundach).

Przykład: BWt 3 → 3 Rundy na 0 Żywotności → utrata przytomności → 3 Rundy później test o życie.

### Ustawienia

- **Zatrucie: test Odporności na koniec Rundy** (domyślnie włączone) — włącza całą regułę.
- **Zatrucie: otwieranie okna testu** — kiedy okno testu otwiera się samo:
  *Gracze automatycznie, BN tylko przycisk* (domyślnie) / *Wszyscy automatycznie (BN u MG)* /
  *Tylko przycisk w czacie*. Karta z przyciskami pojawia się zawsze.
- **Zatrucie: utrata przytomności i śmierć (BWt)** (domyślnie włączone).
- **Zatrucie: kolejne testy o życie** — kiedy po **udanym** teście o życie wypada następny
  (pierwszy zawsze po BWt Rundach nieprzytomności):
  - *Po kolejnych BWt Rundach* (domyślnie) — licznik od nowa,
  - *Co Rundę* — następny test już w kolejnej Rundzie,
  - *Za 1 + PS Rund* — PS z udanego testu kupują czas (PS 0 → kolejna Runda, PS 2 → za 3 Rundy).
- **Zatrucie: nadwyżka PS bez Zmęczenia** (domyślnie wyłączone) — gdy udany Test Odporności lub
  Leczenia zdejmuje więcej poziomów, niż postać ma (1 + PS > poziom), Zatrucie znika **bez
  Zmęczenia** (tak działa system przy nadwyżce). Wyłączone = zasady z podręcznika.

Poza walką test można wywołać makrem:
`game.modules.get("wfrp4e-bare-bones").api.poisonTest(actor)`.

---

## Reguła 4 — Oszołomienie

> Postać z Oszołomieniem nie jest w stanie podejmować żadnych **Akcji**, ale może się przemieszczać
> z połową Szybkości i bronić w Testach Przeciwstawnych (nie Językiem Magicznym).

> Pod koniec każdej Rundy postać może wykonać **Wymagający (+0) Test Odporności**. Jeśli się
> powiedzie, Oszołomienie zmniejszy się o jeden poziom, a każdy PS o dodatkowy poziom. Po usunięciu
> wszystkich poziomów postać otrzymuje **Zmęczenie**, jeśli dotychczas go nie miała.

Polska definicja Stanu nakłada tylko karę do testów. Moduł dokłada resztę:

- **Przypomnienie na początku Tury** oszołomionej postaci (w walce, także pierwszej Tury po starcie
  walki) — z poziomem Oszołomienia.
- **Test Odporności na koniec Rundy** — karta w czacie z przyciskiem „Test Odporności (Oszołomienie)”
  i (wg ustawienia) samo otwierające się okno testu. Każdy test można wykonać raz na Rundę.
  Moduł zdejmuje najwyżej tyle poziomów, ile postać ma, żeby system poprawnie dodał Zmęczenie
  (chyba że włączono opcję „nadwyżka PS bez Zmęczenia”).
- Jeśli postać zaczyna nową Rundę jako pierwsza i okno testu otworzyło się samo, przypomnienie
  o braku Akcji pojawia się **po teście** — i tylko wtedy, gdy Oszołomienie nadal trwa.
- Angielska definicja Stanu z systemu ma własny test na koniec Rundy — wtedy moduł go nie dubluje.

### Ustawienia

- **Oszołomienie: przypomnienie na początku Tury**:
  - *Karta w czacie i powiadomienie* (domyślnie),
  - *Tylko karta w czacie* — publiczna dla postaci graczy, szeptem do MG dla BN,
  - *Tylko powiadomienie* — wyskakuje u gracza-właściciela postaci (BN: u MG),
  - *Wyłączone*.
- **Oszołomienie: Test Odporności na koniec Rundy**:
  - *Gracze automatycznie, BN tylko przycisk* (domyślnie),
  - *Wszyscy automatycznie (BN u MG)*,
  - *Tylko przycisk w czacie*,
  - *Wyłączone*.
- **Oszołomienie: nadwyżka PS bez Zmęczenia** (domyślnie wyłączone) — gdy udany test zdejmuje
  więcej poziomów, niż postać ma (1 + PS > poziom), Oszołomienie znika **bez Zmęczenia** (tak działa
  test w systemie). Wyłączone = zasady z podręcznika.

Poza walką test można wywołać makrem:
`game.modules.get("wfrp4e-bare-bones").api.stunTest(actor)`.

---

## Reguła 5 — Sieczna (z „Do broni!”)

> **Sieczna (X):** Sieczna broń skupia swój tnący potencjał tak, że pozostawia otwarte rany. Jeśli
> broń zada **Ranę Krytyczną**, to poza wszystkimi innymi efektami Rany Krytycznej ofiara otrzymuje
> również **1 poziom Krwawienia**. Możesz wydać **X Przewag**, aby twój przeciwnik otrzymał
> dodatkowy 1 poziom Krwawienia.

System tylko wypisuje przypomnienie o tej cesze — moduł stosuje ją naprawdę:

- Przy **Zastosuj obrażenia** z broni Siecznej, gdy trafienie zadaje Ranę Krytyczną (krytyk w
  rzucie ataku albo obrażenia do 0 Żywotności), ofiara od razu otrzymuje **1 poziom Krwawienia**,
  a w czacie pojawia się karta „Sieczna (X)”.
- Na karcie jest przycisk **„Wydaj Przewagi (X): +1 Krwawienie”** — klika właściciel atakującego
  (albo MG). Moduł sprawdza, czy atakujący ma dość Przewag, odejmuje X Przewag (także przy Przewadze
  grupowej) i nadaje przeciwnikowi dodatkowe Krwawienie. Przycisk działa **raz** na trafienie.
  Kliknięcie gracza wykonuje aktywny MG (gracz zwykle nie ma praw do przeciwnika).
- Krytyk anulowany przez pancerz Nieprzebijalny albo obrażenia zatrzymane przez Ward nie dają
  Krwawienia.

Cechę Sieczna definiuje moduł **„Do broni!” (Up in Arms)**. Bez niego moduł sam dopisuje cechę
„Sieczna” do listy cech broni, więc można ją nadać własnej broni.

### Ustawienia

- **Sieczna: Krwawienie przy Ranie Krytycznej** (domyślnie włączone).
- **Sieczna: przycisk Przewag** (domyślnie włączone).

---

## Reguła 6 — Talent Artystyczny

> Co więcej, dodajesz Umiejętność **Sztuka (Dowolna)** do swojej każdej bieżącej Profesji, a jeśli
> znajduje się ona na liście, koszt każdego Rozwinięcia spada o **5 PD**.

Talent z kompendium systemu daje tylko premię do testów Sztuki — Sztuki nie dopisuje do Profesji,
więc Foundry liczy jej rozwinięcia jak umiejętności spoza Profesji (**podwójny koszt PD**). Talenty
Rzemieślnik i Słuch Absolutny mają do tego skrypt; moduł robi dla Talentu Artystycznego to samo:

- Sztuka postaci **spoza Profesji** → trafia do bieżącej Profesji: znacznik na karcie, przycisk
  rozwinięcia w zakładce Profesji i zwykły koszt PD.
- Sztuka **już w Profesji** → każde Rozwinięcie kosztuje **5 PD mniej**. Wpis „Sztuka (Dowolna)”
  w Profesji też się liczy (system porównuje nazwy dosłownie, więc sam by go nie uznał).
- Działa dla każdej kolejnej Profesji — liczy się zawsze ta bieżąca.

### Jak używać

1. Daj postaci **Talent Artystyczny** (z kompendium albo własny o tej nazwie).
2. Przeciągnij na kartę **Sztukę z wybraną specjalizacją**, np. *Sztuka (Malarstwo)* — talent jej
   nie tworzy, tylko wpina do Profesji.

Talent daje jedną Sztukę: gdy postać ma ich kilka, liczy się ta, która już jest w Profesji, a jeśli
żadna — ta z największą liczbą Rozwinięć. Jeśli efekt talentu ma już własny skrypt *Prepare Data*
(np. wklejony ręcznie), moduł nic nie robi, żeby nie dublować.

### Ustawienie

- **Talent Artystyczny: Sztuka w Profesji** (świat, domyślnie włączone; zmiana wymaga przeładowania).

---

## Narzędzie — Daj kasę (`/give`)

Systemowe `/credit` (karta w czacie z przyciskami „Otrzymaj”) działa tylko dla MG i daje pieniądze
znikąd. `/give` robi to samo dla **gracza, z jego własnej sakiewki**:

```
/give 30zk split=3 reason=Łup
/give 5ss
/give 1zk10ss split=2
```

- Kwota schodzi z **przypisanej postaci** gracza, a w czacie pojawia się karta z `split` równymi
  częściami (domyślnie 1, czyli całość dla jednej osoby). Każdą część może odebrać inna osoba.
- Reszta z dzielenia zostaje u dającego: `/give 1zk split=7` daje 7 × 2 ss 10 bp, a 2 bp zostają.
- Dający nie widzi przycisków na swojej karcie. Nieodebrane części po prostu zostają na karcie.
- Skróty monet są takie jak w systemowym `/pay` i zależą od języka (po polsku `zk`, `ss`, `bp`;
  po angielsku `gc`, `ss`, `bp`).
- Wymaga **aktywnego MG**, bo to jego klient oznacza części jako odebrane.

### Ustawienie

- **Daj kasę: komenda /give** (świat, domyślnie włączone).

---

## Zgodność

- System: `wfrp4e`
- Foundry VTT: v12–v14 (testowane na v13 i v14)

## Autor

[Ilinar](https://github.com/Ilinar)

## Zastrzeżenie

Nieoficjalny moduł fanowski, niezwiązany z Games Workshop ani Cubicle 7. Warhammer Fantasy Roleplay jest znakiem towarowym Games Workshop Ltd.
