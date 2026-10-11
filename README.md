# Same Shape

*Same silhouette. Different souls.*

Ein handgezeichnetes 2D-Horrorspiel: Jede Nacht klopfen kleine Wesen an die Tür des
Lantern House. Alle haben dieselbe Silhouette – und manche sind Monster in fremder Haut.
Du schaust durch den Türspion, prüfst mit Album, Fragen, Taschenlampe und Spiegel und
entscheidest: reinlassen oder draußen lassen.

## Spielen

Das Spiel ist eine statische Webseite ohne Build-Schritt. Jeder einfache Webserver reicht:

```bash
npx http-server . -p 8080 -c-1
# dann im Browser: http://localhost:8080
```

(Direkt per Doppelklick auf `index.html` funktioniert es nicht, weil Browser
JavaScript-Module nur über einen Server laden.)

## Aufbau

| Ordner | Inhalt |
|---|---|
| `js/screens/` | Bildschirme: Menü, Chalks Notizen, Nacht, Morgen, Tag, Album, Enden, Einstellungen, Credits |
| `js/systems/` | Spielregeln, Besuche pro Nacht, Sound |
| `js/render/` | Figuren mit Tells, Schatten, Spiegel, Effekte, Symbole |
| `js/data/` | Figuren, Nächte, Story-Texte, Schwierigkeitsgrade |
| `assets/figures/` | Die Figuren aus den Original-Sheets (`<name>_standard.png`, `<name>_monster.png`, 400 × 560 px) |
| `assets/source/` | Die Original-Sheets |
| `docs/` | Spielregeln (`GDD.md`) und Technik (`ARCHITECTURE.md`) |
| `tests/` | Automatische Tests der Spielregeln (`node tests/run.mjs`) |

**Neue Grafiken einbauen:** Eine neue Zeichnung mit demselben Dateinamen in
`assets/figures/` ersetzt die alte, ohne dass Code geändert werden muss
(transparenter Hintergrund, 400 × 560 px oder ein Vielfaches davon, Füße auf derselben Linie).

## Credits

Siehe [CREDITS.md](CREDITS.md).
