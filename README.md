# TransferBridge

Publieke website van TransferBridge: vervoer van huis naar Schiphol en vanaf Zanderij (PBM) in Suriname, in één boeking.

Boekingen worden voorlopig niet online betaald. Het formulier opent een ingevuld WhatsApp-bericht; TransferBridge stuurt de betaallink zelf terug.

## Bestanden

| Bestand | Wat |
| --- | --- |
| `index.html` | De pagina, met meta-tags, JSON-LD en favicon |
| `css/style.css` | Alle opmaak |
| `js/config.js` | Prijzen en regels: `NL_PRICE`, `SR_PRICE`, `NL_RUSH`, `RUSH_HOURS`, `MAX_PAX`, `MAX_BAGS`, `WA_NUMBER` |
| `js/app.js` | Boekingslogica: ritten, tijdzones, voertuigkeuze, prijs, controle en het WhatsApp-bericht |
| `ontwerp/` | Bronontwerp en specificatie van de klant |

## Lokaal bekijken

```bash
python3 -m http.server 5174
```

Open daarna http://localhost:5174.

## Nog aan te leveren

Gele `[...]`-labels op de site markeren wat nog ontbreekt:

- WhatsApp-nummer (`WA_NUMBER` in `js/config.js`)
- Surinaamse prijzen (`SR_PRICE`) en spoedtoeslag
- Capaciteit bus (`MAX_PAX`, `MAX_BAGS`)
- Kosten no-show, wachtregels Schiphol, ontmoetingsplek Zanderij
- Eigen verhaal en foto voor Over ons
- KvK-nummer, voorwaarden en privacyverklaring (juridisch te controleren), domein
