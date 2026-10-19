# Rood vs Blauw — Random Experiment

Een kleine webapp die heel veel onafhankelijke, eerlijke 50/50-uitkomsten (rood of blauw) genereert en live laat zien. Je kunt je tijdens de berekening op rood of blauw concentreren en daarna zelf bekijken of de verdeling afwijkt. De app is neutraal: een afwijking is géén bewijs van mentale beïnvloeding.

Er is geen backend, database, framework of buildstap nodig.

## Bestanden

| Bestand | Nodig | Inhoud |
|---|---|---|
| `index.html` | ja | pagina |
| `style.css` | ja | opmaak |
| `app.js` | ja | alle logica (de Web Worker zit erin, er is geen apart workerbestand) |
| `README.md` | nee | deze uitleg |
| `test.js` | nee | logicatests voor Node (`node test.js`) |

## Lokaal openen

Dubbelklik op `index.html`. De pagina opent dan in je browser.

Werkt opslaan of de Web Worker niet via `file://` (dat verschilt per browser)? Start dan in deze map een mini-webserver:

```
python3 -m http.server 8000
```

Open daarna <http://localhost:8000>.

## Hosten op een webserver

Kopieer `index.html`, `style.css` en `app.js` naar een map op de server. Extra configuratie is niet nodig.

**Nginx**, bijvoorbeeld in de map `/var/www/roodblauw`:

```
sudo mkdir -p /var/www/roodblauw
sudo cp index.html style.css app.js /var/www/roodblauw/
```

En in je bestaande `server { ... }`-blok:

```
location /roodblauw/ { alias /var/www/roodblauw/; }
```

Daarna `sudo nginx -s reload`. Open de app via `https://jouwdomein/roodblauw/`.

**Apache**: kopieer de drie bestanden naar bijvoorbeeld `/var/www/html/roodblauw/`. Open de app via `https://jouwdomein/roodblauw/`.

Statische hosting zoals GitHub Pages of Netlify werkt ook: upload gewoon de drie bestanden.

## Bediening

- **Start / Stop / Reset.** Na Stop kun je hervatten. Reset wist alles. Na *Voltooid* begint Start een nieuwe sessie.
- **Statussen:** Klaar, Bezig, Gestopt en Voltooid.
- **Tabbladen:** Knipperende vierkanten, Live kleurverdeling en Instellingen. Wisselen tussen tabbladen onderbreekt de sessie niet.
- Alles werkt met het toetsenbord: Tab, Enter of spatie, en de pijltjestoetsen in de tabbalk.

## Instellingen

Het tabblad **Instellingen** bevat vier groepen:

- **Randomgenerator:** gewenste snelheid, batchgrootte, maximale batchgrootte, maximale snelheid, Web Worker aan/uit en maximale looptijd.
- **Animatie:** knippersnelheid (hoogstens 8 per seconde), animatie aan/uit, verminderde beweging respecteren en de overgangsduur van de balk.
- **Livevisualisatie:** werkelijk of versterkt, gevoeligheidsfactor, automatische gevoeligheid, interval tussen schermupdates, middenlijn en getallen in de balk.
- **Sessie:** doorlopend of vaste tijd, duur, automatisch stoppen en de standaardvisualisatie bij het openen.

Wijzigingen werken meteen. Een paar instellingen gelden pas vanaf de volgende sessie: modus, duur, automatisch stoppen en Web Worker. Lopende tellingen worden nooit gereset door een wijziging.

De knoppen werken zo:
- **Instellingen opslaan** bewaart de instellingen in `localStorage`.
- **Wijzigingen ongedaan maken** gaat terug naar de laatst opgeslagen instellingen.
- **Standaardinstellingen herstellen** zet alle waarden terug op de standaard en slaat die op.

Alleen instellingen worden opgeslagen, nooit resultaten. Ongeldige waarden worden begrensd en je krijgt daar een melding van.

## Hoe de randomgenerator werkt

- De bron is `crypto.getRandomValues()`, de cryptografische randomgenerator van de browser.
- Elke bit is één uitkomst: 1 is rood, 0 is blauw. Elke bit is uniform en onafhankelijk. Er wordt niet met modulo gerekend, dus er is ook geen modulo-bias. Per batch worden de bits snel geteld.
- Het werk gebeurt in batches (standaard 1.000 uitkomsten). Alle uitkomsten van een batch worden meegeteld.
- Het tempo volgt de klok. Elke ±20 ms wordt het aantal uitkomsten gemaakt dat op dat moment aan de beurt is, met een tijdslimiet per ronde, zodat er nooit een lange blokkerende lus ontstaat.
- Standaard draait dit in een **Web Worker**, gemaakt via een Blob vanuit `app.js`. Lukt dat niet, dan draait dezelfde code op de hoofdthread.
- Elke sessie krijgt een nummer. Na Stop of Reset wordt de worker beëindigd, en berichten met een oud nummer worden genegeerd. Daardoor komen oude resultaten nooit in een nieuwe sessie terecht.
- Het scherm wordt ongeveer 30 keer per seconde bijgewerkt (`renderIntervalMs`), los van de berekening. De knipperanimatie heeft een eigen timer en wordt niet door de uitkomsten gestuurd.

## Werkelijke verhouding vs versterkte afwijking

- **Werkelijk:** de breedte van rood is het echte percentage rood.
- **Versterkt:** `visueel rood = 50 + (rood% − 50) × factor`, begrensd tot 0–100. Blauw is de rest. Bij factor 10 wordt 50,6% rood in beeld 56% / 44%. Factor 1 is de werkelijke verhouding.
- **Automatisch:** de app kiest zelf een factor (1 tot 1000), zodat de afwijking goed zichtbaar blijft. Deze optie staat standaard uit.

De echte aantallen en percentages staan altijd in de cijfers. De legenda boven de balk vertelt welke weergave actief is.

## Statistiek

- z = (rood − totaal/2) / √(totaal/4)
- De tweezijdige p-waarde is een normale benadering (Abramowitz & Stegun).

Beide zijn beschrijvend. Toeval kan opvallende uitslagen geven, zeker als je het experiment vaak herhaalt. Een conclusie vraagt om een vooraf vastgelegde analyse en herhaling.

## Beperkingen van browsers en timers

- De ingestelde snelheid is een doel, geen garantie. De werkelijk behaalde snelheid wordt getoond. Is de computer te traag, dan wordt maximaal 2 seconden achterstand ingehaald en de rest overgeslagen. De tellers bevatten alleen uitkomsten die echt zijn gemaakt.
- Browsers vertragen timers in achtergrondtabbladen, vooral op de hoofdthread (soms tot 1 keer per seconde of minder). Houd het tabblad dus in beeld. Met een Web Worker heb je er minder last van.
- Mobiele apparaten in de spaarstand kunnen de snelheid flink beperken.
- Knipperende kleuren kunnen hinderlijk zijn bij gevoeligheid voor flitsend licht. Daarom is het maximum 8 per seconde, en gaat het bij "verminderde beweging" naar hoogstens 1 zachte wisseling per seconde.

## Voor ontwikkelaars: een instelling toevoegen

1. Voeg de standaardwaarde toe aan `DEFAULT_CONFIG` in `app.js`.
2. Voeg een regel toe aan `CONFIG_SCHEMA`. Die bevat `key`, `group`, `type` (`int`, `num`, `bool` of `enum`), `min`/`max` (een getal of de naam van een andere instelling), eventueel `presets`/`options`, `label`, `help`, en `next: true` als de instelling pas vanaf de volgende sessie geldt.
3. Het veld verschijnt automatisch in het instellingenscherm en wordt automatisch gecontroleerd door `validateConfig`. Gebruik de waarde in de code via `cfg.jouwSleutel`. Moet een wijziging tijdens een lopende sessie meteen effect hebben, voeg dat dan toe in `applyLive()`.
4. Draai `node test.js`.
