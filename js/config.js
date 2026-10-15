/* TransferBridge: prijzen en regels op één plek.
   Later komen deze waarden uit het beheerdersdashboard of de database. */
window.TB_CONFIG = {
  NL_PRICE: { auto: 55, bus: 65 },   // Amsterdam ↔ Schiphol, beide richtingen
  SR_PRICE: null,                    // [nog aan te leveren] bijv. { auto: 40, bus: 50 }; null = prijs op maat
  NL_RUSH: 0.15,                     // spoedtoeslag op alleen het Nederlandse ritdeel
  SR_RUSH: null,                     // [nog aan te leveren] spoedtoeslag Suriname, nog niet gebruikt
  RUSH_HOURS: 12,                    // binnen zoveel uur is het een spoedaanvraag
  MAX_PAX: 8,                        // [capaciteit bus nog te bevestigen]
  MAX_BAGS: 8,                       // [capaciteit bus nog te bevestigen]
  TZ: { NL: "Europe/Amsterdam", SR: "America/Paramaribo" },
  WA_NUMBER: ""                      // [WhatsApp-nummer TransferBridge, bijv. 31612345678]
};
