const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun, Header, Footer,
  AlignmentType, LevelFormat, BorderStyle, WidthType, ShadingType, PageNumber, PageBreak,
  TabStopType, VerticalAlign, HeadingLevel, Tab,
} = require('docx');

const D = JSON.parse(fs.readFileSync('calc.json', 'utf8'));

// ---------- formatting helpers ----------
const fx = (x, d = 1) => Number(x).toFixed(d);
const inr = (x) => {
  x = Math.round(x);
  const s = String(Math.abs(x));
  let last = s.slice(-3), rest = s.slice(0, -3);
  if (rest) last = ',' + last;
  return (x < 0 ? '-' : '') + rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + last;
};
const lakh = (x) => (x / 100000).toFixed(2);
const thou = (x, d = 0) => Number(x).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

const NAVY = '1F3864', BLUE = '2E75B6', GREY = '595959';
const W = 9406; // content width in DXA (A4, 1250 margins)

// **bold** inline markup -> TextRuns
function runs(text, base = {}) {
  const parts = String(text).split('**');
  return parts.map((t, i) => new TextRun({ text: t, bold: base.bold || i % 2 === 1, italics: base.italics, color: base.color, size: base.size, font: base.font }));
}
const P = (text, o = {}) => new Paragraph({
  alignment: o.align || AlignmentType.LEFT,
  spacing: { after: o.after === undefined ? 120 : o.after, before: o.before || 0, line: 276 },
  keepNext: o.keepNext, indent: o.indent,
  children: runs(text, { size: o.size, color: o.color, italics: o.italics, bold: o.bold }),
});
const H1 = (text, pb = false) => new Paragraph({ heading: HeadingLevel.HEADING_1, keepNext: true, pageBreakBefore: pb, children: [new TextRun({ text })] });
const H2 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true, children: [new TextRun({ text })] });
const B = (text, level = 0) => new Paragraph({
  numbering: { reference: 'bullets', level }, spacing: { after: 60, line: 271 },
  children: runs(text),
});
const Eq = (lines) => lines.map((l, i) => new Paragraph({
  spacing: { after: i === lines.length - 1 ? 140 : 0, before: i === 0 ? 40 : 0, line: 276 },
  indent: { left: 360, right: 200 },
  keepNext: i < lines.length - 1, keepLines: true,
  shading: { type: ShadingType.CLEAR, fill: 'F2F2F2', color: 'auto' },
  border: { left: { style: BorderStyle.SINGLE, size: 18, color: BLUE, space: 8 } },
  children: runs(l, { size: 20 }),
}));
const Note = (label, text) => new Paragraph({
  spacing: { before: 60, after: 160, line: 271 },
  indent: { left: 200, right: 120 },
  shading: { type: ShadingType.CLEAR, fill: 'EAF1FB', color: 'auto' },
  border: { left: { style: BorderStyle.SINGLE, size: 24, color: NAVY, space: 8 } },
  children: [new TextRun({ text: label + ' ', bold: true, color: NAVY, size: 20 }), ...runs(text, { size: 20 })],
});
const Cap = (text) => new Paragraph({
  alignment: AlignmentType.CENTER, spacing: { before: 60, after: 200 },
  children: [new TextRun({ text, italics: true, size: 18, color: GREY })],
});
const TCap = (text) => new Paragraph({
  spacing: { before: 120, after: 80 }, keepNext: true,
  children: [new TextRun({ text, bold: true, size: 19, color: NAVY })],
});
const Sp = (n = 120) => new Paragraph({ spacing: { after: n }, children: [] });
const pngDims = (f) => { const d = fs.readFileSync(f); return [d.readUInt32BE(16), d.readUInt32BE(20)]; };
const Fig = (file, w, _h, alt) => { const [pw, ph] = pngDims(file); const h = Math.round(w * ph / pw); return new Paragraph({
  alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 120, after: 0 },
  children: [new ImageRun({ type: 'png', data: fs.readFileSync(file), transformation: { width: w, height: h }, altText: { title: alt, description: alt, name: alt } })],
}); };

// ---------- tables ----------
const bd = { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF' };
const borders = { top: bd, bottom: bd, left: bd, right: bd };
function cell(text, w, o = {}) {
  return new TableCell({
    width: { size: w, type: WidthType.DXA }, borders,
    columnSpan: o.span,
    shading: o.fill ? { type: ShadingType.CLEAR, fill: o.fill, color: 'auto' } : undefined,
    margins: { top: 55, bottom: 55, left: 100, right: 100 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      alignment: o.align || AlignmentType.LEFT, spacing: { after: 0, line: 252 }, keepNext: o.keep,
      children: runs(text, { bold: o.bold, color: o.color, size: o.size || 19 }),
    })],
  });
}
/**
 * rows: array of arrays (plain rows) or {cells:[], type:'head'|'total'|'sub'}
 * widths: DXA array (sum = table width)
 * aligns: per-column alignment array
 */
function table(headers, rows, widths, aligns = []) {
  const total = widths.reduce((a, b) => a + b, 0);
  const al = (i) => aligns[i] || AlignmentType.LEFT;
  const trs = [];
  if (headers) {
    trs.push(new TableRow({
      tableHeader: true, cantSplit: true,
      children: headers.map((h, i) => cell(h, widths[i], { bold: true, color: 'FFFFFF', fill: NAVY, keep: true, align: i === 0 ? AlignmentType.LEFT : AlignmentType.CENTER })),
    }));
  }
  rows.forEach((r, ri) => {
    const obj = Array.isArray(r) ? { cells: r } : r;
    const type = obj.type;
    trs.push(new TableRow({
      cantSplit: true,
      children: obj.cells.map((c, i) => cell(c, widths[i], {
        bold: type === 'total' || type === 'head' || type === 'sub',
        color: type === 'head' ? 'FFFFFF' : undefined,
        fill: type === 'head' ? NAVY : type === 'total' ? 'DEEAF6' : type === 'sub' ? 'EAF1FB' : (ri % 2 === 1 ? 'F7F9FC' : undefined),
        align: type === 'head' && i > 0 ? AlignmentType.CENTER : al(i),
        keep: rows.length <= 16 && ri < rows.length - 1,
      })),
    }));
  });
  return new Table({ width: { size: total, type: WidthType.DXA }, columnWidths: widths, rows: trs });
}
const R = AlignmentType.RIGHT, C = AlignmentType.CENTER, L = AlignmentType.LEFT;

// ============================================================
// CONTENT
// ============================================================
const c = [];
const S = D.site, LY = D.layout, M = D.mod, ST = D.str, BT = D.bat, CO = D.cost, TF = D.tariff;

// ---------- COVER ----------
c.push(new Paragraph({
  alignment: AlignmentType.CENTER, spacing: { before: 400, after: 800 },
  shading: { type: ShadingType.CLEAR, fill: NAVY, color: 'auto' },
  children: [new TextRun({ text: 'SMART GRID ASSIGNMENT', bold: true, color: 'FFFFFF', size: 30 })],
}));
c.push(new Paragraph({
  alignment: AlignmentType.CENTER, spacing: { after: 800 },
  children: [new TextRun({ text: 'Design and Planning of a Grid-Connected Hybrid Solar PV System for a Residential House in Patiala, Punjab', bold: true, color: BLUE, size: 44, font: 'Times New Roman' })],
}));
c.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: 'Submitted To:', bold: true, size: 30, font: 'Times New Roman' })] }));
c.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 560 }, children: [new TextRun({ text: 'Dr. Shakti Singh', bold: true, size: 30, font: 'Times New Roman' })] }));
c.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: 'Submitted By:', bold: true, size: 30, font: 'Times New Roman' })] }));
c.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: 'Rachit Saini', bold: true, size: 30, font: 'Times New Roman' })] }));
c.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 700 }, children: [new TextRun({ text: '(102304007)', bold: true, size: 30, font: 'Times New Roman' })] }));
c.push(new Paragraph({
  alignment: AlignmentType.CENTER, spacing: { after: 800 },
  children: [new ImageRun({ type: 'png', data: fs.readFileSync('tiet_logo.png'), transformation: { width: 300, height: 172 }, altText: { title: 'TIET logo', description: 'Thapar Institute of Engineering and Technology logo', name: 'TIET logo' } })],
}));
['Electrical & Instrumentation Engineering Department', 'Thapar Institute of Engineering & Technology', 'Patiala - 147004, Punjab', '(Jan-May 2026)'].forEach((t, i, a) => {
  c.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: i === a.length - 1 ? 0 : 20 }, children: [new TextRun({ text: t, bold: true, size: 28, font: 'Times New Roman' })] }));
});
c.push(new Paragraph({ children: [new PageBreak()] }));

// ---------- 1 INTRODUCTION ----------
c.push(H1('1. Introduction'));
c.push(P('Rooftop solar photovoltaic (PV) generation has become one of the most practical ways for an Indian household to cut its electricity bill and reduce dependence on the utility. In Punjab, PSPCL allows rooftop systems to be connected under net metering, where units exported to the grid are banked against units imported and settled on an annual basis. Adding a battery to such a system makes it a hybrid system that can also keep essential loads running when the grid fails.'));
c.push(P('This assignment presents the design and planning of a grid-connected hybrid rooftop solar PV system for a five-member household in a two-storey house in Patiala, Punjab. The consumer can use electricity from three sources: the solar PV array, the battery bank, and the utility grid, depending on solar availability, battery state and load demand. The system is designed to perform the following functions:', { after: 80 }));
[
  'Supply household loads directly from the PV array during daylight hours.',
  'Charge the battery bank when PV output exceeds the instantaneous load.',
  'Draw power from the utility grid when neither PV nor the battery can meet the load.',
  'Export surplus PV energy to the grid through net metering once the battery is charged.',
  'Supply the essential loads from the battery (and PV, when available) for up to seven days of grid outage.',
].forEach((t) => c.push(B(t)));

// ---------- 2 OBJECTIVES & DESIGN BASIS ----------
c.push(H1('2. Objective and Design Basis'));
c.push(P('The objective is to design a grid-connected hybrid rooftop PV system for the house described below, meeting the household energy demand and providing seven days of battery backup for essential loads, while remaining synchronised with the PSPCL grid. The design covers the following tasks:', { after: 80 }));
[
  'Estimate the household load, and calculate daily, monthly and annual energy consumption.',
  'Assess the available rooftop area and its suitability for PV.',
  'Size the PV array and select 550 W monocrystalline TOPCon modules.',
  'Design the string configuration and verify it against the inverter limits at extreme temperatures.',
  'Size the hybrid inverter and the LiFePO4 battery bank for 7-day backup of essential loads.',
  'Select cables and protection devices, and explain grid synchronisation, anti-islanding and net metering.',
  'Estimate the project cost, annual savings and payback period, and summarise the engineering verdict.',
].forEach((t) => c.push(B(t)));
c.push(TCap('Table 1: Design basis and assumptions'));
c.push(table(['Parameter', 'Value adopted'], [
  ['Location', 'Patiala, Punjab, India (30.34° N, 76.39° E)'],
  ['Household', 'Five members, two-storey house, three split air conditioners'],
  ['Backup requirement (assignment brief)', '7 days for essential loads'],
  ['PV module (assignment brief)', '550 W monocrystalline half-cut TOPCon'],
  ['Utility supply', 'PSPCL, 415 V three-phase, 50 Hz, net metering with annual settlement'],
  ['Tariff basis', `PSERC FY 2026-27 domestic tariff: ₹${TF.t1.toFixed(2)}/kWh up to 300 units per month and ₹${TF.t2.toFixed(2)}/kWh above 300 units (energy charge only)`],
  ['Battery design factors', 'LiFePO4, 90% usable depth of discharge, 92% discharge-path efficiency, 90% ageing and temperature derating'],
  ['Design temperatures', '-5 °C minimum ambient (string Voc check); 45 °C ambient and 70 °C cell temperature (string Vmp check)'],
], [3000, 6406]));
c.push(Sp(80));

// ---------- 3 SITE ----------
c.push(H1('3. Site Details and Rooftop Area'));
c.push(H2('3.1 Plot Area and Roof Area'));
c.push(P(`The house stands on a 10-marla plot. In Punjab, 1 marla = 272.25 ft² = ${fx(S.marla, 2)} m². The ground coverage is assumed to be 60%, and the roof footprint is taken equal to the ground-floor footprint.`));
c.push(...Eq([
  `Plot area = 10 × ${fx(S.marla, 2)} = ${fx(S.plot, 1)} m² (about ${fx(S.plot_sqyd, 0)} sq yd, or ${thou(S.plot_ft2)} ft²)`,
  `Roof footprint = Plot area × Ground coverage = ${fx(S.plot, 1)} × 0.60 = ${fx(S.foot, 1)} m² (about ${thou(S.foot_ft2)} ft²)`,
]));
c.push(P(`The roof is taken as a rectangle of ${fx(S.L, 1)} m (east-west) × ${fx(S.W, 2)} m (north-south).`));
c.push(H2('3.2 Usable Rooftop Area'));
c.push(P('Not all of the roof can carry PV modules. A 0.6 m strip along the parapet is kept clear to avoid parapet shading and to allow access, and several fixed structures take up further space. Table 2 builds up the usable area step by step.'));
c.push(TCap('Table 2: Usable rooftop area'));
const rows2 = [
  ['Gross roof area', fx(S.foot, 1)],
  [`Less: 0.6 m perimeter setback (parapet shadow and access)`, `-${fx(S.foot - S.inner, 1)}`],
  { cells: ['Inner roof area (13.8 m × 8.92 m)', fx(S.inner, 1)], type: 'sub' },
  ...S.ded.map(([n, v]) => [`Less: ${n}`, `-${fx(v, 1)}`]),
  { cells: ['Calculated usable area', fx(S.usable_calc, 1)], type: 'sub' },
  { cells: ['Selected usable rooftop area for design', `${fx(S.usable_sel, 0)}`], type: 'total' },
];
c.push(table(['Item', 'Area (m²)'], rows2, [7000, 2406], [L, R]));
c.push(Sp(60));

// ---------- 4 LOAD ----------
c.push(H1('4. Load Assessment'));
c.push(H2('4.1 Daily Load on a Peak-Summer Day'));
c.push(P('The household load is estimated for a peak-summer day, when the air conditioners run and the demand is highest. The air conditioners are modern 1.5-ton inverter splits with an average running input of 1.1 kW, used for a combined 18 hours per day across three bedrooms.'));
c.push(TCap('Table 3: Daily load table (peak-summer day)'));
const rows3 = D.loads.map((l) => [l[0], l[1], fx(l[2], l[2] < 0.1 ? 3 : 2), fx(l[3], 1), fx(l[4], 2)]);
rows3.push({ cells: ['Total daily energy demand', '', '', '', fx(D.E_day, 2)], type: 'total' });
c.push(table(['Load', 'Quantity', 'Power (kW)', 'Hours/day', 'Energy (kWh/day)'], rows3, [3500, 1200, 1400, 1300, 2006], [L, C, R, R, R]));
c.push(Sp(80));
c.push(...Eq([
  `Air conditioners: 3 × 1.10 kW × 6 h = ${fx(D.loads[0][4], 2)} kWh/day`,
  `Ceiling fans: 6 × 0.075 kW × 10 h = ${fx(D.loads[1][4], 2)} kWh/day`,
  `Total = ${D.loads.map((l) => fx(l[4], 2)).join(' + ')} = ${fx(D.E_day, 2)} kWh/day`,
]));
c.push(H2('4.2 Seasonal Consumption and Annual Energy'));
c.push(P(`Multiplying a peak-summer day by 365 would overstate the annual demand, because the air conditioners are needed for only part of the year and a geyser or room heater is needed in winter. The annual demand is therefore built month by month: the non-air-conditioning base load is ${fx(D.base_day, 2)} kWh/day, the air-conditioning energy of ${fx(D.AC_day, 2)} kWh/day is scaled by a monthly utilisation factor, and a winter heating allowance is added for December to March and November.`));
c.push(TCap('Table 4: Monthly load model'));
const rows4 = D.months.map((m, i) => [m, `${Math.round(D.acf[i] * 100)}%`, fx(D.heat[i], 1), fx(D.daily_load[i], 2), thou(D.mload[i])]);
rows4.push({ cells: ['Annual', '', '', fx(D.E_year / 365, 2) + ' (avg)', thou(D.E_year)], type: 'total' });
c.push(table(['Month', 'AC utilisation', 'Heating (kWh/day)', 'Daily load (kWh/day)', 'Monthly load (kWh)'], rows4, [1500, 1800, 2000, 2106, 2000], [L, C, R, R, R]));
c.push(Sp(80));
c.push(TCap('Table 5: Summary of consumption'));
c.push(table(['Period', 'Consumption'], [
  ['Peak-summer day', `${fx(D.E_day, 2)} kWh/day (${fx(D.E_day, 2)} units/day)`],
  ['Peak month (May)', `${thou(D.mload[4])} kWh/month`],
  ['Average month', `${thou(D.E_year / 12)} kWh/month`],
  ['Annual', `${thou(D.E_year)} kWh/year (${thou(D.E_year)} units/year)`],
], [3400, 6006]));
c.push(Sp(60));

// ---------- 5 PEAK LOAD ----------
c.push(H1('5. Peak Load Estimation'));
c.push(P('The connected load is the sum of the ratings of all appliances that could run in the same hour. A diversity factor of 0.85 is applied because not every appliance runs at full power together, and a further 25% margin covers motor starting currents and future additions.'));
c.push(TCap('Table 6: Connected load and design demand'));
const rows6 = D.peak.map(([n, v]) => [n, fx(v, 2)]);
rows6.push({ cells: ['Total connected load', fx(D.conn, 2)], type: 'sub' });
rows6.push(['Coincident demand (diversity factor 0.85)', fx(D.coinc, 2)]);
rows6.push({ cells: ['Design demand (+25% margin)', fx(D.design_peak, 2)], type: 'total' });
c.push(table(['Appliance / load', 'Power (kW)'], rows6, [7000, 2406], [L, R]));
c.push(Sp(80));
c.push(...Eq([
  `Connected load = ${D.peak.map(([, v]) => fx(v, 2)).join(' + ')} = ${fx(D.conn, 2)} kW`,
  `Coincident demand = ${fx(D.conn, 2)} × 0.85 = ${fx(D.coinc, 2)} kW`,
  `Design demand = ${fx(D.coinc, 2)} × 1.25 = ${fx(D.design_peak, 2)} kW ≈ 8.5 kW`,
]));
c.push(P('A sanctioned load of at least 8 kW is therefore appropriate. This matters for the grid connection, because the rooftop capacity PSPCL permits is tied to the consumer’s sanctioned load; the 6.6 kWp array selected later in this report sits within it.'));

// ---------- 6 ESSENTIAL LOAD ----------
c.push(H1('6. Essential Load for Battery Backup'));
c.push(P('Backing up the whole house for seven days would need an impractically large battery, so the backup is limited to the loads that must keep running during an outage. The air conditioners, kitchen appliances and washing machine are excluded. During an outage the household is assumed to run a reduced pattern of use: four of the six fans, one pumping cycle a day and fewer hours of lighting and TV.'));
c.push(TCap('Table 7: Essential load during grid failure'));
const rows7 = D.ess.map((e) => [e[0], e[1], fx(e[2], e[2] < 0.1 ? 3 : 2), fx(e[3], 1), fx(e[4], 2)]);
rows7.push({ cells: ['Total essential load', '', '', '', fx(D.E_ess, 2)], type: 'total' });
c.push(table(['Essential load', 'Quantity', 'Power (kW)', 'Hours/day', 'Energy (kWh/day)'], rows7, [3500, 1400, 1300, 1200, 2006], [L, C, R, R, R]));
c.push(Sp(80));
c.push(...Eq([
  `Essential load = ${D.ess.map((e) => fx(e[4], 2)).join(' + ')} = ${fx(D.E_ess, 2)} kWh/day`,
  `Backup energy for 7 days = ${fx(D.E_ess, 2)} × 7 = ${fx(D.E_bk, 2)} kWh`,
]));
c.push(P(`The essential loads draw about 1.75 kW when running together (fans 0.30 kW, refrigerator 0.25 kW, pump 0.75 kW, lighting 0.14 kW, TV 0.10 kW, IT 0.20 kW). Allowing for the starting surge of the pump and refrigerator compressor, the peak is about 3.8 kW, which is within the 6 kW backup rating of the selected inverter. The essential load is ${fx(D.fh.share * 100, 0)}% of the full-house load.`));

// ---------- 7 BATTERY ----------
c.push(H1('7. Battery Bank Sizing (7-Day Autonomy)'));
c.push(H2('7.1 Battery Technology'));
c.push(P('LiFePO4 (lithium iron phosphate) is selected over lead-acid for the following reasons:', { after: 80 }));
[
  'Usable depth of discharge of 90% or more, against about 50% for lead-acid.',
  'Cycle life of 3,000 to 6,000 cycles or more, and a calendar life of about 10 to 15 years.',
  'Round-trip efficiency above 90%, and almost no maintenance.',
  'The most thermally stable lithium chemistry, with no gas emission or acid handling.',
  'Direct communication with modern hybrid inverters through a CAN or RS485 battery-management link.',
].forEach((t) => c.push(B(t)));
c.push(H2('7.2 Battery Capacity Calculation'));
c.push(P('Three factors reduce the nameplate energy that is actually available to the load. They are the usable depth of discharge (DoD), the discharge-path efficiency (battery discharge and inverter DC-to-AC conversion), and a derating for ageing and low-temperature operation so that the 7-day target is still met late in the battery’s life.'));
c.push(TCap('Table 8: Battery design factors'));
c.push(table(['Factor', 'Value', 'Basis'], [
  ['Usable depth of discharge (DoD)', '90%', 'Typical for LiFePO4 rack modules'],
  ['Discharge-path efficiency', '92%', 'About 96% battery discharge × 96% inverter'],
  ['Ageing and temperature derating', '90%', 'Capacity retained at end of design life'],
  ['Backup duration', '7 days', 'Assignment requirement'],
], [3400, 1500, 4506], [L, C, L]));
c.push(Sp(80));
c.push(...Eq([
  'Battery capacity = Backup energy / (DoD × Efficiency × Derating)',
  `Battery capacity = ${fx(D.E_bk, 2)} / (0.90 × 0.92 × 0.90) = ${fx(D.E_bk, 2)} / 0.7452 = ${fx(BT.cap_req, 2)} kWh`,
]));
c.push(P(`Using 5.12 kWh LiFePO4 rack modules (51.2 V, 100 Ah), the number of modules is ${fx(BT.cap_req, 2)} / 5.12 = ${fx(BT.cap_req / 5.12, 2)}, rounded up to ${BT.n_bat}.`));
c.push(...Eq([
  `Selected battery bank = ${BT.n_bat} × 5.12 kWh = ${fx(BT.cap_sel, 1)} kWh LiFePO4`,
  `Usable energy (new battery) = ${fx(BT.cap_sel, 1)} × 0.90 × 0.92 = ${fx(BT.usable_BOL, 2)} kWh`,
  `Backup duration (new battery) = ${fx(BT.usable_BOL, 2)} / ${fx(D.E_ess, 2)} = ${fx(BT.days_BOL, 2)} days`,
  `Usable energy at 90% capacity = ${fx(BT.usable_BOL, 2)} × 0.90 = ${fx(BT.usable_EOL, 2)} kWh, giving ${fx(BT.days_EOL, 2)} days`,
]));
c.push(P(`The ${fx(BT.cap_sel, 1)} kWh bank therefore delivers about ${fx(BT.days_BOL, 1)} days of essential-load backup when new and still meets the full 7 days after it has aged to 90% of its rated capacity. The average essential load of about 0.34 kW is under 0.5% of the bank’s capacity per hour, so the battery works at a very gentle rate.`));
c.push(H2('7.3 Recharging After an Outage'));
c.push(P(`Over 7 days the battery delivers ${fx(D.E_bk, 2)} kWh to the loads, which is ${fx(D.rech.E_drawn, 1)} kWh at the battery terminals, and about ${fx(D.rech.E_pv_needed, 1)} kWh must be put back allowing 95% charging efficiency. Once the grid returns, the inverter can recharge the battery from the grid and PV together.`));
c.push(...Eq([
  `Grid recharge time at 5 kW = ${fx(D.rech.E_pv_needed, 1)} / 5 = ${fx(D.rech.t_grid, 1)} hours`,
]));
const ts = D.rech.t_solar;
c.push(P(`Recharging from the daily solar surplus alone is much slower and depends on the season. Using the monthly balance in Section 15, the surplus would refill the battery in about ${fx(ts[2], 0)} days in March, ${fx(ts[9], 0)} days in October, and roughly ${fx(ts[4], 0)} to ${fx(ts[8], 0)} days in May and September. There is no surplus in June, July or August. The energy-management settings should therefore allow grid charging after an outage.`));
c.push(Note('Note:', 'The 7-day figure is the conservative case in which the PV array contributes nothing during the outage. In island mode the inverter also runs the essential loads directly from PV during daylight, so on ordinary days the battery discharges much less than the figure above assumes.'));

// ---------- 8 FULL HOUSE ----------
c.push(H1('8. Full-House Backup: Comparison and Justification'));
c.push(P('To justify limiting the backup to essential loads, the battery needed for a full-house 7-day backup is calculated below.'));
c.push(...Eq([
  `Full-house energy for 7 days = ${fx(D.E_day, 2)} × 7 = ${fx(D.fh.E_fh, 2)} kWh`,
  `Battery capacity = ${fx(D.fh.E_fh, 2)} / 0.7452 = ${fx(D.fh.cap_fh, 1)} kWh`,
  `Approximate cost at ₹22,000 per kWh = ₹${lakh(D.fh.cap_fh * 22000)} lakh`,
]));
c.push(P(`A bank of about ${fx(D.fh.cap_fh, 0)} kWh is ${fx(D.fh.ratio, 1)} times the essential-load bank, would cost roughly ₹${fx(D.fh.cap_fh * 22000 / 100000, 0)} lakh, and would need a space and fire-safety arrangement closer to a commercial installation than a home. Limiting the backup to essential loads is the sensible engineering decision. The air conditioners run from solar during the day and from the grid at other times, and are not backed up by the battery.`));

// ---------- 9 SOLAR RESOURCE ----------
c.push(H1('9. Solar Resource and Performance Ratio'));
c.push(H2('9.1 Peak Sun Hours for Patiala'));
c.push(P('Peak sun hours (PSH) express the daily solar energy on the module plane as an equivalent number of hours at 1,000 W/m². For a module tilted at 25° and facing south, representative monthly values for Patiala are given in Table 9. These are assumed design values typical of north-western India, with lower winter values that allow for fog and haze. They should be replaced with site data from PVGIS or the Global Solar Atlas before any real installation.'));
c.push(TCap('Table 9: Assumed peak sun hours on a 25° tilted plane (kWh/m²/day)'));
const psh = D.psh, mo = D.months;
c.push(table(null, [
  { cells: ['Month', ...mo.slice(0, 6)], type: 'head' },
  ['PSH', ...psh.slice(0, 6).map((v) => fx(v, 1))],
  { cells: ['Month', ...mo.slice(6)], type: 'head' },
  ['PSH', ...psh.slice(6).map((v) => fx(v, 1))],
], [1906, 1250, 1250, 1250, 1250, 1250, 1250], [L, C, C, C, C, C, C]));
c.push(Sp(80));
c.push(P(`The annual mean is ${fx(D.psh_avg, 2)} PSH/day, equal to ${thou(D.GTI_year)} kWh/m² per year on the module plane.`));
c.push(H2('9.2 Performance Ratio'));
c.push(P('The performance ratio (PR) accounts for all the losses between the irradiation received and the AC energy delivered. It is built up from the loss budget in Table 10.'));
c.push(TCap('Table 10: Loss budget'));
const rows10 = D.losses.map(([n, v]) => [n, fx(v, 1) + '%', fx(1 - v / 100, 3)]);
rows10.push({ cells: ['Computed performance ratio', '', fx(D.PR_calc, 3)], type: 'sub' });
rows10.push({ cells: ['Design performance ratio adopted', '', fx(D.PR, 2)], type: 'total' });
c.push(table(['Loss factor', 'Loss', 'Retained fraction'], rows10, [5200, 1800, 2406], [L, R, R]));
c.push(Sp(60));
c.push(P(`The design PR of ${fx(D.PR, 2)} is about 4% below the computed ${fx(D.PR_calc, 3)}, which leaves a margin for first-year module degradation and uncertainty in the resource data.`));

// ---------- 10 PV SIZING ----------
c.push(H1('10. Solar PV Array Sizing'));
c.push(P('Two methods are used to bound the array size.'));
c.push(H2('10.1 Method A: Peak-day energy'));
c.push(...Eq([
  'PV size = Daily energy / (PSH × PR)',
  `PV size = ${fx(D.E_day, 2)} / (${fx(D.psh_avg, 2)} × ${fx(D.PR, 2)}) = ${fx(D.pv_peakday, 2)} kWp`,
]));
c.push(P('This sizes the array so that even a peak-summer day is met entirely from PV at average irradiation. It is the upper bound, because the house does not run at this level for most of the year.'));
c.push(H2('10.2 Method B: Annual net-metering balance'));
c.push(P('PSPCL settles net metering on an annual basis, so units exported in winter and spring are banked and offset the units imported in monsoon months. The annual energy balance is therefore the governing criterion.'));
c.push(...Eq([
  'PV size = Annual energy / (Annual irradiation × PR)',
  `PV size = ${thou(D.E_year)} / (${thou(D.GTI_year)} × ${fx(D.PR, 2)}) = ${fx(D.pv_annual, 2)} kWp`,
]));
c.push(H2('10.3 Selected capacity'));
c.push(P(`The annual balance gives ${fx(D.pv_annual, 1)} kWp and the peak-day method gives ${fx(D.pv_peakday, 1)} kWp. A capacity of **${fx(D.kWp, 1)} kWp** is selected, which is ${fx((D.kWp / D.pv_annual - 1) * 100, 0)}% above the annual minimum. The margin covers battery charging losses, module degradation over the years, a poor-weather year and future loads such as an EV charger or an extra air conditioner. As Section 15 shows, this size also brings generation close to the load in the peak months of May and June.`));
c.push(Eq([`Selected PV array capacity = ${fx(D.kWp, 1)} kWp`])[0]);

// ---------- 11 MODULE ----------
c.push(H1('11. Solar Module Selection'));
c.push(P('The module is a 550 W monocrystalline half-cut TOPCon (Tunnel Oxide Passivated Contact) module, as required by the assignment brief. TOPCon cells offer higher efficiency, a lower temperature coefficient and better low-light response than PERC cells. The half-cut design halves the current in each cell section, reducing resistive loss and improving partial-shading tolerance.'));
c.push(H2('11.1 Module electrical parameters'));
c.push(P('Table 11 lists typical datasheet values for a 550 W TOPCon module. They are assumed for this design and must be replaced with the values from the datasheet of the module actually purchased.'));
c.push(TCap('Table 11: 550 W module parameters (typical, at STC)'));
c.push(table(['Parameter', 'Symbol', 'Value'], [
  ['Maximum power', 'Pmax', '550 W'],
  ['Voltage at maximum power', 'Vmp', `${fx(M.Vmp, 1)} V`],
  ['Current at maximum power', 'Imp', `${fx(M.Imp, 2)} A`],
  ['Open-circuit voltage', 'Voc', `${fx(M.Voc, 1)} V`],
  ['Short-circuit current', 'Isc', `${fx(M.Isc, 2)} A`],
  ['Dimensions', 'L × W', `${thou(M.L * 1000)} × ${thou(M.W * 1000)} mm (${fx(M.area, 2)} m²)`],
  ['Module efficiency', 'η', `${fx(M.eff, 1)}%`],
  ['Temperature coefficient of Pmax', '', `${fx(M.bP, 2)} %/°C`],
  ['Temperature coefficient of Voc', '', `${fx(M.bVoc, 2)} %/°C`],
  ['Temperature coefficient of Vmp (assumed)', '', `${fx(M.bVmp, 2)} %/°C`],
  ['Temperature coefficient of Isc', '', `+${fx(M.bIsc, 3)} %/°C`],
], [4200, 1800, 3406], [L, C, L]));
c.push(Sp(80));
c.push(H2('11.2 Design significance of Vmp and Voc'));
c.push(P('**Vmp** is the voltage at which the module delivers maximum power under standard test conditions (1,000 W/m², 25 °C, AM 1.5). It is used to check that the string operating voltage stays inside the MPPT window of the inverter. **Voc** is the voltage with no load connected, and it is always higher than Vmp. Voc rises in cold weather, so it is used to make sure the string never exceeds the maximum DC input voltage of the inverter.'));
c.push(H2('11.3 Number of modules'));
c.push(...Eq([
  `Number of modules = ${thou(D.kWp * 1000)} W / 550 W = ${D.n_mod}`,
  `Installed PV capacity = ${D.n_mod} × 550 W = ${thou(D.n_mod * 550)} W = ${fx(D.kWp, 1)} kWp`,
]));

// ---------- 12 LAYOUT ----------
c.push(H1('12. Rooftop Layout and Feasibility'));
c.push(H2('12.1 Tilt and row spacing'));
c.push(P(`The modules face true south at a fixed tilt of ${fx(LY.tilt, 0)}°, which is close to the optimum annual angle for Patiala and keeps the structure low. The row pitch is set so that the front row does not shade the rear row at solar noon on the winter solstice, when the sun is lowest.`));
c.push(...Eq([
  `Sun altitude at winter solstice noon = 90° - ${fx(LY.lat, 2)}° - ${fx(LY.decl, 2)}° = ${fx(LY.alt, 2)}°`,
  `Module height above roof = 2.278 × sin ${fx(LY.tilt, 0)}° = ${fx(LY.h, 3)} m`,
  `Horizontal projection = 2.278 × cos ${fx(LY.tilt, 0)}° = ${fx(LY.proj, 3)} m`,
  `Shadow length = ${fx(LY.h, 3)} / tan ${fx(LY.alt, 2)}° = ${fx(LY.shadow, 3)} m`,
  `Minimum row pitch = ${fx(LY.proj, 3)} + ${fx(LY.shadow, 3)} = ${fx(LY.pitch_min, 3)} m; adopted pitch = ${fx(LY.pitch, 1)} m`,
]));
c.push(H2('12.2 Array layout and area check'));
c.push(P(`The 12 modules are mounted in portrait orientation in two rows of six. Each row forms one string. A 0.6 m walkway is left around the array for maintenance.`));
c.push(...Eq([
  `Array width = 6 × 1.134 + 5 × 0.02 = ${fx(LY.row_w, 2)} m`,
  `Array depth = ${fx(LY.proj, 3)} + ${fx(LY.pitch, 1)} = ${fx(LY.depth, 2)} m`,
  `Envelope with 0.6 m walkway = ${fx(LY.env_w, 2)} × ${fx(LY.env_d, 2)} = ${fx(LY.env_area, 1)} m²`,
  `Module area = ${D.n_mod} × ${fx(M.area, 3)} = ${fx(LY.mod_area_total, 1)} m²; practical area factor = ${fx(LY.env_area, 1)} / ${fx(LY.mod_area_total, 1)} = ${fx(LY.factor, 2)}`,
]));
c.push(P(`The layout-based factor of ${fx(LY.factor, 2)} falls within the usual 1.5 to 1.8 range for rooftop arrays, giving a practical requirement of ${fx(LY.need_lo, 0)} to ${fx(LY.need_hi, 0)} m² (${fx(LY.env_area, 1)} m² from the detailed layout). The usable roof is ${fx(S.usable_sel, 0)} m², so the system is feasible with about ${fx(S.usable_sel - LY.env_area, 0)} m² to spare, enough for up to about 8 more modules if the load grows. The array is placed south of the mumty and water tanks so their shadows fall away from it.`));
c.push(Fig('fig_roof.png', 540, 0, 'Indicative rooftop layout'));
c.push(Cap('Figure 1: Indicative rooftop layout (plan view, north at top)'));

// ---------- 13 STRINGS ----------
c.push(H1('13. PV String Configuration'));
c.push(P(`The 12 modules are arranged as **2 strings of 6 modules in series**. Each string is connected to its own MPPT input of the inverter, so the two strings are never paralleled. This gives each row independent maximum-power tracking, which helps in the early morning and late afternoon when the front row can shade the rear row. Six modules in series also keep the voltage well below the inverter maximum while staying above its minimum MPPT voltage even on the hottest days.`));
c.push(H2('13.1 String voltage and current'));
c.push(...Eq([
  `String Vmp (STC) = 6 × ${fx(M.Vmp, 1)} = ${fx(ST.S_Vmp_stc, 1)} V;  String Voc (STC) = 6 × ${fx(M.Voc, 1)} = ${fx(ST.S_Voc_stc, 1)} V`,
  `Current per string = Imp = ${fx(M.Imp, 2)} A (series connection: the current does not add)`,
  `Power per string = 6 × 550 = ${thou(ST.S_P)} W`,
]));
c.push(H2('13.2 Extreme-temperature checks'));
c.push(P('The STC values are not enough. On a cold winter morning Voc is higher, and on a hot afternoon Vmp is lower. Both extremes are checked against the inverter window.'));
c.push(...Eq([
  `Cold Voc per module at ${ST.Tmin} °C = ${fx(M.Voc, 1)} × [1 + 0.0025 × (25 - (${ST.Tmin}))] = ${fx(ST.Voc_cold, 2)} V`,
  `String Voc (cold) = 6 × ${fx(ST.Voc_cold, 2)} = ${fx(ST.S_Voc_cold, 1)} V`,
  `Hot Vmp per module at ${ST.Tcell} °C cell = ${fx(M.Vmp, 1)} × [1 - 0.003 × (${ST.Tcell} - 25)] = ${fx(ST.Vmp_hot, 2)} V`,
  `String Vmp (hot) = 6 × ${fx(ST.Vmp_hot, 2)} = ${fx(ST.S_Vmp_hot, 1)} V`,
  `Design current for cables and switches = 1.25 × Isc = 1.25 × ${fx(M.Isc, 2)} = ${fx(ST.Imax, 1)} A`,
]));
c.push(TCap('Table 12: String design versus inverter DC input requirements'));
c.push(table(['Parameter', 'Inverter requirement (typical)', 'Design value', 'Check'], [
  ['Maximum DC input voltage', '≥ 1,000 V', `${fx(ST.S_Voc_cold, 0)} V (cold Voc)`, 'Pass'],
  ['MPPT voltage range', '160 to 850 V', `${fx(ST.S_Vmp_hot, 0)} to ${fx(ST.S_Vmp_cold, 0)} V`, 'Pass'],
  ['Start-up voltage', '≤ 180 V', `${fx(ST.S_Vmp_hot, 0)} V (hot Vmp)`, 'Pass'],
  ['Number of MPPT inputs', '2', '2 (one string each)', 'Pass'],
  ['Maximum input current per MPPT', '≥ 15 A', `${fx(M.Imp, 1)} A`, 'Pass'],
  ['Maximum Isc per MPPT', '≥ 20 A', `${fx(M.Isc, 2)} A (${fx(ST.Imax, 1)} A with 1.25 factor)`, 'Pass'],
  ['DC/AC ratio', '1.0 to 1.3', fx(D.inv.dcac, 2), 'Pass'],
], [2600, 2400, 2906, 1500], [L, C, C, C]));
c.push(Sp(60));
c.push(Note('Note:', 'The inverter limits in Table 12 are typical for a 6 kW three-phase hybrid inverter and must be confirmed against the datasheet of the model finally selected. A production design should also use a site-specific record low temperature for the cold Voc check.'));
c.push(TCap('Table 13: Final string design summary'));
c.push(table(['Parameter', 'Value'], [
  ['Total modules', `${D.n_mod}`],
  ['String configuration', '2 strings × 6 modules in series, one string per MPPT'],
  ['Module rating', '550 W'],
  ['Total PV capacity', `${fx(D.kWp, 1)} kWp`],
  ['String Vmp / Voc at STC', `${fx(ST.S_Vmp_stc, 1)} V / ${fx(ST.S_Voc_stc, 1)} V`],
  ['String Voc at -5 °C', `${fx(ST.S_Voc_cold, 1)} V`],
  ['String Vmp at 70 °C cell temperature', `${fx(ST.S_Vmp_hot, 1)} V`],
  ['Current per string (Imp / Isc)', `${fx(M.Imp, 2)} A / ${fx(M.Isc, 2)} A`],
], [4200, 5206]));
c.push(Sp(60));

// ---------- 14 INVERTER ----------
c.push(H1('14. Hybrid Inverter Sizing and Selection'));
c.push(P(`Selected inverter: **6 kW three-phase hybrid solar inverter**, with a 6.6 kWp array (DC/AC ratio ${fx(D.inv.dcac, 2)}) and a design house demand of ${fx(D.design_peak, 1)} kW.`));
c.push(H2('14.1 Justification'));
[
  `A DC/AC ratio of ${fx(D.inv.dcac, 2)} is in the normal 1.0 to 1.3 range, so PV clipping is negligible.`,
  'The 6 kW backup (EPS) rating comfortably covers the 3.8 kW essential-load peak including starting surge.',
  'During grid operation the whole-house load is fed from the grid and inverter together, so the inverter does not have to carry the full 8.5 kW demand.',
  'A three-phase inverter suits a three-phase house connection and spreads the injected power across the phases. The permissible injection on the actual connection should be confirmed with PSPCL.',
  'It manages the PV array, the battery and the grid, and can charge the LiFePO4 bank from PV and from the grid.',
].forEach((t) => c.push(B(t)));
c.push(H2('14.2 Required inverter specifications'));
c.push(TCap('Table 14: Inverter specification'));
c.push(table(['Specification', 'Requirement'], [
  ['Type', 'Three-phase hybrid solar inverter, grid-tied with battery port and backup output'],
  ['AC output', '415 V three-phase, 50 Hz; supports unbalanced load on the backup output'],
  ['Rated AC power', '6 kW'],
  ['PV inputs', '2 independent MPPTs; 1,000 V maximum; window as in Table 12'],
  ['Battery', 'High-voltage LiFePO4 port with CAN/RS485 BMS communication; charge from PV and grid'],
  ['Grid functions', 'Import, export and net-metering support; adjustable export limit'],
  ['Anti-islanding', 'Mandatory, to IEC 62116 (disconnection within 2 s of grid loss)'],
  ['Protections', 'Over/under voltage and frequency, insulation and earth-fault monitoring, DC reverse polarity, surge protection'],
  ['Backup changeover', 'Automatic, ≤ 20 ms, to essential-load panel'],
  ['Enclosure and efficiency', 'IP65 or better; European efficiency of 97% or more'],
], [2800, 6606]));
c.push(Sp(80));
c.push(Note('Design caution:', `A ${fx(BT.cap_sel, 1)} kWh battery is larger than many residential hybrid inverters can accept on their battery port. The chosen inverter must support this capacity through parallel battery clusters, or a second battery inverter must be added. This has to be confirmed with the manufacturer before ordering.`));

// ---------- 15 GENERATION ----------
c.push(H1('15. Solar Generation and Monthly Energy Balance'));
c.push(...Eq([
  'Generation = PV capacity × PSH × PR',
  `Average daily generation = ${fx(D.kWp, 1)} × ${fx(D.psh_avg, 2)} × ${fx(D.PR, 2)} = ${fx(D.G_year / 365, 1)} kWh/day`,
  `Annual generation = ${fx(D.kWp, 1)} × ${thou(D.GTI_year)} × ${fx(D.PR, 2)} = ${thou(D.G_year)} kWh/year (specific yield ${thou(D.spec_yield)} kWh/kWp)`,
]));
c.push(TCap('Table 15: Monthly energy balance'));
const rows15 = mo.map((m, i) => [m, fx(psh[i], 1), fx(D.gen_daily[i], 1), thou(D.mload[i]), thou(D.mgen[i]), (D.net_m[i] >= 0 ? '+' : '-') + thou(Math.abs(D.net_m[i]))]);
rows15.push({ cells: ['Annual', fx(D.psh_avg, 2), fx(D.G_year / 365, 1), thou(D.E_year), thou(D.G_year), '+' + thou(D.net_year)], type: 'total' });
c.push(table(['Month', 'PSH', 'PV (kWh/day)', 'Load (kWh)', 'PV (kWh)', 'Net (kWh)'], rows15, [1400, 1100, 1700, 1700, 1700, 1806], [L, C, R, R, R, R]));
c.push(Sp(80));
c.push(Fig('fig_monthly.png', 580, 0, 'Monthly load versus PV generation'));
c.push(Cap('Figure 2: Monthly household load and PV generation'));
c.push(P(`Annual generation of ${thou(D.G_year)} kWh covers ${fx(D.cover * 100, 0)}% of the ${thou(D.E_year)} kWh annual load, leaving a net surplus of about ${thou(D.net_year)} kWh. Generation is very close to the load in May (${thou(D.mgen[4])} kWh against ${thou(D.mload[4])} kWh). The array falls short in June, July and August (by ${thou(-D.net_m[5])}, ${thou(-D.net_m[6])} and ${thou(-D.net_m[7])} kWh) because of monsoon cloud and air conditioning, but these deficits are covered by units banked earlier in the year under annual net metering.`));
c.push(P('These are theoretical averages. Actual values will vary with cloud and haze, dust, shading, module temperature (output drops about 0.30% per °C above 25 °C), battery and inverter losses, and the actual household load pattern.'));

// ---------- 16 CABLES & PROTECTION ----------
c.push(H1('16. Cable Sizing and Protection Devices'));
c.push(H2('16.1 DC side (string cables)'));
c.push(...Eq([
  `Design current = 1.25 × Isc = 1.25 × ${fx(M.Isc, 2)} = ${fx(ST.Imax, 1)} A`,
  'Cable: 6 mm² solar-rated copper cable (UV-resistant, double-insulated, to EN 50618 / IEC 62930)',
  'Voltage-drop check for a 25 m one-way run (50 m loop), ρ(Cu, 70 °C) = 0.021 Ω·mm²/m:',
  'R = 0.021 × 50 / 6 = 0.175 Ω;  drop = 13.0 A × 0.175 Ω = 2.28 V = 0.90% of string Vmp (limit 1%)',
]));
c.push(P('A 4 mm² cable would drop about 1.3% over the same run, which is why 6 mm² is chosen. The values are indicative; the final size depends on the actual run length, routing and grouping.'));
c.push(H2('16.2 AC side'));
c.push(...Eq([
  `Inverter AC current = P / (√3 × V) = 6,000 / (1.732 × 415) = ${fx(D.inv.Iac, 2)} A`,
  `With 1.25 factor = ${fx(D.inv.Iac125, 2)} A, so a 16 A 4-pole MCB is selected`,
  'Cable: 4-core 4 mm² armoured copper; for a 30 m run, R = 0.021 × 30 / 4 = 0.158 Ω per conductor',
  `Voltage drop = √3 × ${fx(D.inv.Iac, 2)} × 0.158 = 2.28 V = 0.55% of 415 V (limit 1%)`,
]));
c.push(H2('16.3 Protection devices'));
c.push(TCap('Table 16: Protection schedule'));
c.push(table(['Section', 'Device', 'Rating / note'], [
  { cells: ['DC side', '', ''], type: 'sub' },
  ['', 'DC isolator', '1,000 V DC, 25 A (≥ 1.25 × Isc)'],
  ['', 'String fuse (if fitted)', '25 A gPV; between 1.5 and 2.4 × Isc and within the module’s series-fuse rating'],
  ['', 'Surge protection', 'Type II DC SPD, Uc ≥ 1.2 × cold Voc, at the DCDB and inverter input'],
  { cells: ['AC side', '', ''], type: 'sub' },
  ['', 'Lockable AC isolator', 'Accessible to PSPCL for maintenance isolation'],
  ['', 'MCB', '4-pole, 16 A, C-curve'],
  ['', 'RCCB', '4-pole, 30 mA; type A or B as the inverter manufacturer requires'],
  ['', 'Surge protection', 'Type II AC SPD at the distribution board'],
  ['', 'Meter', 'Bidirectional net meter to PSPCL specification'],
  { cells: ['Battery side', '', ''], type: 'sub' },
  ['', 'BMS', 'Monitors state of charge, cell voltage, temperature and overcurrent; CAN/RS485 link to inverter'],
  ['', 'DC breaker and fuse', 'Sized to the inverter’s maximum battery current, per manufacturer'],
  ['', 'Enclosure', 'Ventilated, fire-rated, IEC 62619-certified modules, smoke and heat detection'],
  { cells: ['General', '', ''], type: 'sub' },
  ['', 'Earthing', 'Module frames, structure and equipment bonded to low-resistance earth pits (target below 5 Ω), IS 3043'],
  ['', 'Lightning protection', 'Air terminal and down-conductor bonded to the earth system (IS/IEC 62305)'],
], [1800, 2600, 5006]));
c.push(Sp(60));
c.push(Note('Note:', 'Cable and protection ratings are indicative. Final sizing must be confirmed by a licensed electrical engineer for the actual cable lengths, conduit type, ambient temperature, grouping factors and local standards such as IS 694 and IS 1554.'));

// ---------- 17 GRID ----------
c.push(H1('17. Grid Synchronisation, Anti-Islanding and Net Metering'));
c.push(H2('17.1 Grid synchronisation'));
c.push(P('The hybrid inverter turns DC from the PV array and battery into AC. To run in parallel with the grid it must match the grid in three respects:', { after: 80 }));
[
  '**Voltage:** 230 V line-to-neutral (415 V line-to-line), within the permitted window.',
  '**Frequency:** 50 Hz, the Indian grid frequency.',
  '**Phase angle and sequence:** the output waveform must be aligned with the grid waveform on all three phases.',
].forEach((t) => c.push(B(t)));
c.push(P('A phase-locked loop (PLL) inside the inverter continuously tracks grid voltage, frequency and phase. After a grid outage the inverter reconnects only when the grid has stayed within limits for a set delay, typically one to five minutes.'));
c.push(H2('17.2 Power flow under different conditions'));
c.push(TCap('Table 17: Power flow'));
c.push(table(['Condition', 'Power flow'], [
  ['Solar equals load', 'PV supplies the full house load. No grid import and no battery exchange.'],
  ['Solar is less than load', 'PV and the grid together supply the load. The battery stays on reserve.'],
  ['Solar exceeds load, battery not full', 'PV supplies the load, the surplus charges the battery, and any remainder is exported.'],
  ['Solar exceeds load, battery full', 'PV supplies the load and all surplus is exported through the net meter.'],
  ['Night, grid available', 'The grid supplies the load. The battery holds its backup reserve for outages.'],
  ['Grid failure', 'The inverter isolates from the grid and supplies the essential-load panel from the battery, with PV support in daylight. Air conditioners and other non-essential loads are disconnected.'],
  ['Grid restored after outage', 'The inverter resynchronises, reconnects, and recharges the battery from the grid and PV.'],
], [3000, 6406]));
c.push(Sp(80));
c.push(P('Because the battery exists mainly for outages, its backup-reserve setting should be kept high so that it is not drained by everyday use. Daily cycling would save little under the slab tariff used here, where no time-of-day price difference is assumed.'));
c.push(H2('17.3 Anti-islanding protection'));
c.push(P('Anti-islanding is a mandatory safety function for every grid-connected inverter. If the grid fails, the inverter must disconnect within a short time limit (2 seconds under the IEC 62116 test). Otherwise it would keep energising a dead network and endanger utility staff working on it. Detection relies on over/under-voltage and over/under-frequency limits, rate-of-change-of-frequency, and active islanding-detection methods. In this hybrid system the inverter isolates from the grid and then forms a local island that supplies only the essential-load panel. The lockable AC isolator gives PSPCL a visible point of isolation.'));
c.push(H2('17.4 Net metering under PSPCL'));
c.push(P('Under the PSERC rooftop solar regulations, a consumer may install a grid-interactive system with net metering. A bidirectional meter records imports and exports. The billed energy is the net of the two, and any excess is banked and settled on an annual basis. The application is made through the PSPCL solar portal, and technical feasibility depends on the consumer’s sanctioned load and the capacity of the local distribution transformer. Electricity duty is levied only on the net billed amount.'));

// ---------- 18 BLOCK DIAGRAM ----------
c.push(H1('18. System Block Diagram'));
c.push(P('Figure 3 shows the architecture of the proposed hybrid system and the direction of power flow between its main parts.'));
c.push(Fig('fig_block.png', 520, 0, 'System block diagram'));
c.push(Cap('Figure 3: Block diagram of the grid-connected hybrid solar PV system'));
c.push(H2('18.1 Component description'));
[
  `**Solar PV array:** ${D.n_mod} modules of 550 W (${fx(D.kWp, 1)} kWp) in two series strings of six modules.`,
  '**DC combiner box:** carries the DC isolator and surge protection, and passes each string to its own MPPT input.',
  '**Hybrid inverter (6 kW, three-phase):** converts DC to AC, tracks the maximum power point, manages flow between PV, battery, loads and grid, and provides the backup output.',
  `**Battery bank:** ${BT.n_bat} × 5.12 kWh LiFePO4 modules (${fx(BT.cap_sel, 1)} kWh) with a BMS that talks to the inverter.`,
  '**AC distribution board:** feeds the household circuits and separates essential from non-essential loads.',
  '**Bidirectional net meter:** records energy imported from and exported to the PSPCL grid.',
].forEach((t) => c.push(B(t)));

// ---------- 19 COST ----------
c.push(H1('19. Cost Estimate'));
c.push(P('The figures below are indicative 2026 Indian market values and are meant for academic estimation. They are based on retail price listings for LFP batteries (roughly ₹20,000 to ₹28,000 per kWh) and hybrid inverters, and actual costs will vary with brand, supplier and site. Final figures should come from installer quotations.'));
c.push(TCap('Table 18: Component-wise cost of the hybrid system'));
const cc = CO.c;
c.push(table(['Component', 'Basis', 'Cost (₹)'], [
  ['PV modules', `${D.n_mod} × 550 W TOPCon at ₹25/Wp`, inr(cc.modules)],
  ['Mounting structure', `${fx(D.kWp, 1)} kWp at ₹5,000/kWp, hot-dip galvanised`, inr(cc.structure)],
  ['Hybrid inverter', '6 kW three-phase, lump sum', inr(cc.inv_hyb)],
  ['LiFePO4 battery bank', `${fx(BT.cap_sel, 1)} kWh at ₹22,000/kWh`, inr(cc.battery)],
  ['DC-side balance of system', 'Cables, DCDB, isolator, SPD', inr(cc.dc)],
  ['AC-side balance of system', 'Cable, ACDB, MCB, RCCB, SPD, essential panel', inr(cc.ac)],
  ['Earthing and lightning protection', 'Lump sum', inr(cc.earth)],
  ['Battery enclosure and safety', 'Rack, breaker, ventilation, fire protection', inr(cc.encl)],
  ['Net metering', 'Application, bidirectional meter, drawings', inr(cc.netm)],
  ['Installation and commissioning', 'Labour, transport, civil work', inr(cc.labour)],
  { cells: ['Total estimated project cost', '', `${inr(CO.tot_hyb)} (₹${lakh(CO.tot_hyb)} lakh)`], type: 'total' },
], [2900, 3606, 2900], [L, L, R]));
c.push(Sp(80));
c.push(P(`The battery bank costs ₹${lakh(cc.battery)} lakh, which is ${fx(CO.batt_share * 100, 0)}% of the total project cost. It dominates the budget, and this is a direct consequence of specifying seven days of autonomy.`));
c.push(TCap('Table 19: Solar-only comparison system (PV with on-grid inverter, no battery)'));
c.push(table(['Component', 'Cost (₹)'], [
  ['PV modules and mounting structure', inr(cc.modules + cc.structure)],
  ['6 kW three-phase on-grid inverter', inr(cc.inv_ong)],
  ['DC and AC balance of system, earthing', inr(cc.dc + cc.ac_o + cc.earth)],
  ['Net metering, installation and commissioning', inr(cc.netm + cc.labour_o)],
  { cells: ['Total solar-only cost', `${inr(CO.tot_pv)} (₹${lakh(CO.tot_pv)} lakh)`], type: 'total' },
], [6400, 3006], [L, R]));
c.push(Sp(60));

// ---------- 20 SAVINGS ----------
c.push(H1('20. Electricity Savings and Payback Period'));
c.push(H2('20.1 Annual savings'));
c.push(P(`The PSERC tariff order for FY 2026-27 sets the domestic energy charge at ₹${TF.t1.toFixed(2)}/kWh for the first 300 units in a month and ₹${TF.t2.toFixed(2)}/kWh above that. This household exceeds 300 units in every month of the load model, so each month is billed at both slab rates. Because the array generates more than the household uses over the year, net annual import is close to zero and the saving is taken as the annual energy-charge bill that would otherwise be paid.`));
c.push(TCap('Table 20: Monthly energy-charge bill without solar'));
const half = 6;
c.push(table(null, [
  { cells: ['Month', ...mo.slice(0, half)], type: 'head' },
  ['Bill (₹)', ...TF.bill.slice(0, half).map((v) => inr(v))],
  { cells: ['Month', ...mo.slice(half)], type: 'head' },
  ['Bill (₹)', ...TF.bill.slice(half).map((v) => inr(v))],
], [1606, 1300, 1300, 1300, 1300, 1300, 1300], [L, C, C, C, C, C, C]));
c.push(Sp(80));
c.push(...Eq([
  `Monthly bill = 300 × ₹${TF.t1.toFixed(2)} + (Units - 300) × ₹${TF.t2.toFixed(2)}   (for example, May: 300 × 3.85 + ${thou(D.mload[4] - 300)} × 7.05 = ₹${inr(TF.bill[4])})`,
  `Annual saving = ₹${inr(TF.bill_year)} (about ₹${fx(TF.bill_year / 100000, 2)} lakh per year)`,
]));
c.push(H2('20.2 Simple payback'));
c.push(TCap('Table 21: Payback comparison'));
c.push(table(['Scenario', 'System cost', 'Annual saving', 'Simple payback'], [
  ['Hybrid system with 76.8 kWh battery', `₹${lakh(CO.tot_hyb)} lakh`, `₹${fx(TF.bill_year / 100000, 2)} lakh`, `${fx(CO.pb_hyb, 1)} years`],
  ['Hybrid system, after ₹78,000 subsidy', `₹${lakh(CO.tot_hyb - CO.subs)} lakh`, `₹${fx(TF.bill_year / 100000, 2)} lakh`, `${fx(CO.pb_hyb_s, 1)} years`],
  ['Solar-only system (no battery)', `₹${lakh(CO.tot_pv)} lakh`, `₹${fx(TF.bill_year / 100000, 2)} lakh`, `${fx(CO.pb_pv, 1)} years`],
  ['Solar-only, after ₹78,000 subsidy', `₹${lakh(CO.tot_pv - CO.subs)} lakh`, `₹${fx(TF.bill_year / 100000, 2)} lakh`, `${fx(CO.pb_pv_s, 1)} years`],
], [3800, 1900, 1800, 1906], [L, R, R, R]));
c.push(Sp(80));
c.push(P('The subsidy rows assume the household qualifies for the central financial assistance of up to ₹78,000 under PM Surya Ghar: Muft Bijli Yojana, which does not cover the battery and requires listed modules. Eligibility and the amount should be checked against the current scheme rules.'));
const incr = CO.incr;
c.push(P(`The 7-day battery adds ₹${lakh(incr)} lakh to a ₹${lakh(CO.tot_pv)} lakh solar system. Spread over a 12-year battery life, that is about ₹${fx(incr / 12 / 100000, 2)} lakh per year, roughly ${fx(incr / 12 / TF.bill_year, 1)} times the annual electricity saving. A payback of ${fx(CO.pb_hyb, 0)} years is also far longer than the battery’s own life, so the battery cannot be justified as a money-saving item. It is a resilience purchase, and its value lies in keeping essential loads running through a long outage.`));
c.push(Note('Assumptions:', 'Savings use energy charges only. Electricity duty, fixed charges and fuel adjustments are excluded, PSPCL bills in kVAh but unity power factor is assumed, the state free-units scheme is not modelled, and the 1,595 kWh year-end surplus is given no value. PV degradation and tariff escalation are neglected.'));

// ---------- 21 RISKS ----------
c.push(H1('21. Design Risks and Recommendations'));
c.push(H2('21.1 Right-sizing the battery in stages'));
c.push(P('Because the battery is modular, it can be added in stages. Table 22 shows the battery size and cost for shorter autonomy periods, using the same design factors as Section 7.'));
const rowsA = [1, 2, 3, 7].map((d) => {
  const req = D.E_ess * d / (BT.DoD * BT.eta * BT.age);
  const n = Math.ceil(req / 5.12);
  return [`${d} day${d > 1 ? 's' : ''}`, fx(req, 1), `${n}`, fx(n * 5.12, 1), lakh(n * 5.12 * 22000)];
});
c.push(TCap('Table 22: Battery size and cost versus autonomy'));
c.push(table(['Autonomy', 'Required (kWh)', 'Modules', 'Installed (kWh)', 'Battery cost (₹ lakh)'], rowsA, [1900, 1900, 1500, 1900, 2206], [L, R, C, R, R]));
c.push(Sp(80));
c.push(P('Grid outages in urban areas typically last hours rather than days, so a smaller battery would cover the common cases at a fraction of the cost. The 7-day design is kept here because the brief requires it, but the inverter and enclosure can be chosen so that modules are added over time.'));
c.push(H2('21.2 Other points to address before installation'));
[
  '**Inverter and battery compatibility:** confirm that the inverter accepts a 76.8 kWh bank (parallel clusters or a second battery inverter).',
  '**Battery safety:** house the bank in a ventilated, fire-separated space away from habitable rooms and exits, with smoke detection, and check the requirement with the local fire authority.',
  '**Resource data:** replace the assumed peak-sun-hours in Table 9 with PVGIS or Global Solar Atlas values for the exact site.',
  '**Sanctioned load and transformer capacity:** confirm the sanctioned load (8 kW or more) and the distribution transformer hosting capacity with PSPCL before applying.',
  '**Structure and roof:** design the mounting for local wind loads (IS 875 Part 3), protect the waterproofing at anchor points, and keep the array clear of the mumty and tank shadows.',
  '**Cleaning:** wash the modules about every two weeks in the dry season, since soiling is the largest avoidable loss after temperature.',
].forEach((t) => c.push(B(t)));

// ---------- 22 SUMMARY ----------
c.push(H1('22. Final Design Summary', true));
c.push(TCap('Table 23: Final design summary'));
c.push(table(['Parameter', 'Final design value'], [
  { cells: ['Site and load', ''], type: 'sub' },
  ['Location', 'Patiala, Punjab, India'],
  ['System type', 'Grid-connected hybrid rooftop solar PV system'],
  ['Peak-summer daily load', `${fx(D.E_day, 2)} kWh/day`],
  ['Annual load', `${thou(D.E_year)} kWh/year`],
  ['Design demand', `${fx(D.design_peak, 1)} kW (connected load ${fx(D.conn, 2)} kW)`],
  ['Available / required roof area', `${fx(S.usable_sel, 0)} m² / ${fx(LY.env_area, 1)} m²`],
  { cells: ['PV array', ''], type: 'sub' },
  ['PV module', '550 W monocrystalline TOPCon half-cut'],
  ['Number of modules and capacity', `${D.n_mod} modules, ${fx(D.kWp, 1)} kWp`],
  ['Tilt, orientation, row pitch', `${fx(LY.tilt, 0)}°, true south, ${fx(LY.pitch, 1)} m`],
  ['String configuration', '2 strings × 6 modules in series'],
  ['String Vmp / Voc (STC)', `${fx(ST.S_Vmp_stc, 1)} V / ${fx(ST.S_Voc_stc, 1)} V`],
  ['String Voc at -5 °C', `${fx(ST.S_Voc_cold, 1)} V`],
  ['Annual generation', `${thou(D.G_year)} kWh/year (${thou(D.spec_yield)} kWh/kWp)`],
  { cells: ['Inverter and battery', ''], type: 'sub' },
  ['Inverter', '6 kW three-phase hybrid, 2 MPPT'],
  ['Essential load', `${fx(D.E_ess, 2)} kWh/day`],
  ['Battery', `${BT.n_bat} × 5.12 kWh LiFePO4 = ${fx(BT.cap_sel, 1)} kWh`],
  ['Backup duration', `7 days (${fx(BT.days_BOL, 1)} days new, ${fx(BT.days_EOL, 1)} days at 90% capacity)`],
  { cells: ['Electrical and economics', ''], type: 'sub' },
  ['DC string cable', '6 mm² solar cable'],
  ['AC output cable / protection', '4C × 4 mm² Cu; 4-pole 16 A MCB, 30 mA RCCB'],
  ['Total project cost', `₹${lakh(CO.tot_hyb)} lakh`],
  ['Annual electricity saving', `₹${fx(TF.bill_year / 100000, 2)} lakh/year`],
  ['Payback (with battery / solar-only)', `${fx(CO.pb_hyb, 0)} years / ${fx(CO.pb_pv, 1)} years`],
], [4000, 5406]));
c.push(Sp(60));

// ---------- 23 CONCLUSION ----------
c.push(H1('23. Conclusion'));
c.push(P(`The proposed system is a ${fx(D.kWp, 1)} kWp grid-connected hybrid rooftop PV system for a five-member household in Patiala, Punjab. It uses ${D.n_mod} modules of 550 W in two strings of six, feeding a 6 kW three-phase hybrid inverter. The array is expected to generate about ${thou(D.G_year)} kWh a year against an annual load of about ${thou(D.E_year)} kWh, so net annual import is close to zero under PSPCL’s annual net metering.`));
c.push(P(`The battery is a ${fx(BT.cap_sel, 1)} kWh LiFePO4 bank sized for seven days of essential-load backup (${fx(D.E_ess, 2)} kWh/day for fans, refrigerator, pump, lighting and IT). It provides about ${fx(BT.days_BOL, 1)} days when new and still meets seven days at 90% of rated capacity. The air conditioners are deliberately left off the backup, since backing up the full house would need about ${fx(D.fh.cap_fh, 0)} kWh of storage.`));
c.push(P(`The site is suitable. The array needs about ${fx(LY.env_area, 0)} m² of the ${fx(S.usable_sel, 0)} m² of usable roof, and the string voltages stay within the inverter window at both -5 °C and 70 °C cell temperature. The estimated cost is about ₹${lakh(CO.tot_hyb)} lakh, of which the battery is ${fx(CO.batt_share * 100, 0)}%. The solar-only part costs about ₹${lakh(CO.tot_pv)} lakh and pays back in roughly ${fx(CO.pb_pv, 1)} years.`));
c.push(new Paragraph({
  heading: HeadingLevel.HEADING_2, keepNext: true, spacing: { before: 200 },
  children: [new TextRun({ text: 'Final Engineering Verdict' })],
}));
c.push(P(`A ${fx(D.kWp, 1)} kWp hybrid rooftop PV system with a ${fx(BT.cap_sel, 1)} kWh LiFePO4 battery is technically feasible for the selected house. It meets the annual energy demand, provides at least seven days of essential-load backup, reduces grid dependence and allows import and export through net metering. Financially, however, the PV part is attractive and the battery is not: it multiplies the project cost more than five times and is not recovered through savings within its life. The battery should be treated as a resilience investment. The recommended approach is to install the PV array and a hybrid-ready inverter first, and to add battery modules in stages, sized to the outage duration the household actually needs to ride through.`));

// ---------- REFERENCES ----------
c.push(H1('References'));
[
  'Punjab State Electricity Regulatory Commission (PSERC), Tariff Order for PSPCL and PSTCL, FY 2026-27 (effective 1 April 2026 to 31 March 2027), as reported in the press in March and July 2026.',
  'PSERC, Grid Interactive Rooftop Solar Photovoltaic Systems Regulations, 2021, as amended; PEDA and PSPCL rooftop solar information pages.',
  'Ministry of New and Renewable Energy, PM Surya Ghar: Muft Bijli Yojana, central financial assistance for residential rooftop solar.',
  'European Commission JRC, PVGIS; World Bank Group and Solargis, Global Solar Atlas (site resource data, to be used to verify Table 9).',
  'IEC 62548 (PV array design), IEC 62109-1 and -2 (inverter safety), IEC 62116 (anti-islanding), IEC 61215 and IEC 61730 (module qualification and safety, IS 14286), IEC 62619 (lithium battery safety).',
  'IS 3043 (earthing), IS/IEC 62305 (lightning protection), IS 875 Part 3 (wind loads), IS 694 and IS 1554 (cables).',
  'Central Electricity Authority, Technical Standards for Connectivity of the Distributed Generation Resources Regulations, as amended.',
  'Indicative 2026 Indian retail price listings for LFP storage batteries and hybrid inverters (used for the cost estimate in Section 19).',
].forEach((t, i) => c.push(new Paragraph({
  spacing: { after: 80, line: 262 }, indent: { left: 400, hanging: 400 },
  children: [new TextRun({ text: `[${i + 1}]  `, bold: true, size: 19 }), new TextRun({ text: t, size: 19 })],
})));

// ============================================================
// DOCUMENT
// ============================================================
const headerPara = new Paragraph({
  style: 'HFText',
  border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '7F7F7F', space: 4 } },
  tabStops: [{ type: TabStopType.RIGHT, position: W }],
  spacing: { after: 0 },
  children: [
    new TextRun({ text: 'Grid-Connected Hybrid Solar PV System, Patiala, Punjab', size: 16, color: GREY }),
    new TextRun({ children: [new Tab(), 'Rachit Saini (102304007)'], size: 16, color: GREY }),
  ],
});
const footerPara = new Paragraph({
  style: 'HFText',
  border: { top: { style: BorderStyle.SINGLE, size: 4, color: '7F7F7F', space: 4 } },
  tabStops: [{ type: TabStopType.RIGHT, position: W }],
  spacing: { before: 0 },
  children: [
    new TextRun({ text: 'Smart Grid Assignment', size: 16, color: GREY }),
    new TextRun({ children: [new Tab(), 'Page '], size: 16, color: GREY }),
    new TextRun({ children: [PageNumber.CURRENT], size: 16, color: GREY }),
    new TextRun({ text: ' of ', size: 16, color: GREY }),
    new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: GREY }),
  ],
});

const doc = new Document({
  creator: 'Rachit Saini',
  title: 'Design and Planning of a Grid-Connected Hybrid Solar PV System for a Residential House in Patiala, Punjab',
  styles: {
    default: { document: { run: { font: 'Arial', size: 21 } } },
    paragraphStyles: [
      { id: 'HFText', name: 'Header Footer Text', basedOn: 'Normal', run: { size: 16, color: GREY, font: 'Arial' } },
      {
        id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 30, bold: true, color: NAVY, font: 'Arial' },
        paragraph: { spacing: { before: 360, after: 140 }, outlineLevel: 0, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BLUE, space: 3 } } },
      },
      {
        id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 23, bold: true, color: BLUE, font: 'Arial' },
        paragraph: { spacing: { before: 220, after: 100 }, outlineLevel: 1 },
      },
    ],
  },
  numbering: {
    config: [{
      reference: 'bullets',
      levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 560, hanging: 280 } } } }],
    }],
  },
  sections: [{
    properties: {
      titlePage: true,
      page: { size: { width: 11906, height: 16838 }, margin: { top: 1300, bottom: 1200, left: 1250, right: 1250, header: 600, footer: 550 } },
    },
    headers: { default: new Header({ children: [headerPara] }), first: new Header({ children: [new Paragraph({ children: [] })] }) },
    footers: { default: new Footer({ children: [footerPara] }), first: new Footer({ children: [new Paragraph({ children: [] })] }) },
    children: c,
  }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync('Rachit_Saini_102304007_Hybrid_Solar_PV_Patiala.docx', buf);
  console.log('written', buf.length);
});
