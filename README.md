# Grid-Connected Hybrid Solar PV System, Patiala

Smart Grid assignment (TIET Patiala): design of a 6.6 kWp grid-connected hybrid rooftop PV system
with a 76.8 kWh LiFePO4 battery giving 7 days of essential-load backup for a 10-marla house in Patiala, Punjab.

**Report:** `Rachit_Saini_102304007_Hybrid_Solar_PV_Patiala.pdf`

## Design summary

| Item | Value |
|---|---|
| PV array | 12 x 550 W TOPCon = 6.6 kWp (2 strings x 6 modules) |
| Inverter | 6 kW three-phase hybrid, 2 MPPT |
| Battery | 15 x 5.12 kWh LiFePO4 = 76.8 kWh |
| Essential load | 8.17 kWh/day (7-day backup, new and at 90% capacity) |
| Annual load / generation | 8,236 kWh / 9,832 kWh |
| Estimated cost | about Rs 22.06 lakh (solar-only about Rs 4.00 lakh) |

Module datasheet values and monthly peak-sun-hours are assumed design values; prices are indicative 2026 figures.

## Rebuilding the report

The report is generated from the design calculations, so changing an input reflows every number in the document.

```bash
pip install matplotlib pillow
npm install docx
cd src
python3 calc.py        # design calculations -> calc.json
python3 make_figs.py   # block diagram, roof plan, monthly chart
node build.js          # writes the .docx
```

- `src/calc.py` holds all inputs (load table, peak sun hours, losses, module data, battery factors, prices).
- `src/make_figs.py` draws the three figures.
- `src/build.js` assembles the Word document with `docx`.

The TIET logo used on the cover page belongs to Thapar Institute of Engineering & Technology.
