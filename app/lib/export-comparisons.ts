// ============================================================================
// Saved History export — the comparisons on screen, as an Excel workbook
// ============================================================================
// .xlsx so the report can carry formatting: columns are grouped under coloured
// bands (Comparison, Zoho Enquiry, Client, …) so a reader can find their way
// across ~25 columns, with frozen headers, filters and AED number formats.
// Two layouts: one row per comparison (the report), or one row per insurer's
// quote (for pivot tables). Each workbook also carries a "Report Info" sheet
// recording the filters it was exported with.
//
// exceljs is large, so it's loaded only when someone actually exports. The
// type-only import below is erased at build time and adds nothing to the bundle.

import type { Borders, Fill, Workbook } from 'exceljs';
import type { Quote, SavedComparison } from './types';

// What the on-screen filters were, for the Report Info sheet.
export interface ExportFilters {
  period: string;
  insuranceLine: string;
  search: string;
}

// The calendar day a date falls on in the browser's own time zone, as
// yyyy-mm-dd. Never toISOString(), which is UTC: in the UAE anything saved
// before 4am would land on the previous day.
export const localDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// ---------------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------------
type Value = string | number | Date | null | undefined;

// Real Date objects, so Excel can sort and filter them as dates. Excel dates
// have no time zone and exceljs writes them as UTC, so shift to the local
// clock — otherwise every time shows 4 hours early in the UAE.
const localDate = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000);
const toDate = (dateStr?: string) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : localDate(d);
};

const amount = (value: unknown) => {
  const n = Number(value);
  return value === null || value === undefined || value === '' || !Number.isFinite(n)
    ? null
    : Math.round(n * 100) / 100;
};

// What the client pays for a quote (premium + policy fee + VAT). A quote left
// at 0 was never filled in, so it doesn't count as the cheapest.
const totalOf = (q: Quote) => {
  const n = amount(q.total);
  return n !== null && n > 0 ? n : null;
};

const aed = (n: number) =>
  `AED ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const unique = (values: (string | undefined)[]) =>
  Array.from(new Set(values.map(v => v?.trim()).filter(Boolean))).join(', ');

// This app has no "client's current policy" marker on a quote, so the linked
// Zoho enquiry is the only source: Renewal when its type or sub-type says so.
const businessType = (c: SavedComparison) =>
  /renew/i.test(`${c.enquiry?.subType || ''} ${c.enquiry?.insuranceType || ''}`) ? 'Renewal' : 'New';

// Older comparisons hold a number typed in by hand and no linked enquiry.
const enquiryNoOf = (c: SavedComparison) => c.enquiry?.enquiryNo || c.enquiryNumber;

// ---------------------------------------------------------------------------
// Layouts: column groups, each with a band colour
// ---------------------------------------------------------------------------
// text | int | money | date | flag (Yes/No) | business (New/Renewal) | status
type ColumnType = 'text' | 'int' | 'money' | 'date' | 'flag' | 'business' | 'status';
interface Column { header: string; width: number; type: ColumnType }
interface Group { title: string; color: string; columns: Column[] }

const C = (header: string, width: number, type: ColumnType = 'text'): Column => ({ header, width, type });

const RED = '#c8102e';

const COMPARISON_GROUPS: Group[] = [
  {
    title: 'Comparison',
    color: RED,
    columns: [C('Quote Ref No.', 18), C('New / Renewal', 13, 'business'), C('Insurance Line', 30)],
  },
  {
    title: 'Zoho Enquiry',
    color: '#1f3a5f',
    columns: [C('Enquiry No.', 14), C('Enquiry Name', 30), C('Insurance Type', 20)],
  },
  {
    title: 'Client',
    color: '#0f766e',
    columns: [
      C('Client Name', 28),
      C('Business Activity', 24),
      C('Location / Risk Address', 28),
      C('Address', 28),
      C('Property Insured - Limit', 20),
    ],
  },
  {
    title: 'Quotes',
    color: '#6d28d9',
    columns: [C('Quotes', 8, 'int'), C('Insurers Quoted', 30), C('Quotes Compared', 60)],
  },
  {
    title: 'Premiums (AED)',
    color: '#15803d',
    columns: [C('Lowest', 13, 'money'), C('Highest', 13, 'money'), C('Spread', 13, 'money')],
  },
  {
    title: 'Recommended (AED)',
    color: '#a16207',
    columns: [C('Recommended Insurer', 28), C('Recommended Premium', 14, 'money')],
  },
  {
    title: 'Record',
    color: '#4b5563',
    columns: [C('Created Date', 17, 'date')],
  },
];

const comparisonRow = (c: SavedComparison): Value[] => {
  const quotes = Array.isArray(c.quotes) ? c.quotes : [];
  const totals = quotes.map(totalOf);
  const priced = totals.filter((t): t is number => t !== null);
  const low = priced.length ? Math.min(...priced) : null;
  const high = priced.length ? Math.max(...priced) : null;
  const recommended = quotes.findIndex(q => q.isRecommended);
  const e = c.enquiry;

  return [
    c.referenceNumber,
    businessType(c),
    c.insuranceLine,
    enquiryNoOf(c),
    e?.enquiryName,
    [e?.insuranceType, e?.subType].filter(Boolean).join(' · '),
    c.customerName,
    c.businessActivity,
    c.location,
    c.address,
    c.propertyLimit,
    quotes.length,
    unique(quotes.map(q => q.company)),
    quotes
      .map((q, i) => (totals[i] === null ? q.company : `${q.company} (${aed(totals[i]!)})`))
      .join('; '),
    low,
    high,
    low !== null && high !== null ? amount(high - low) : null,
    recommended < 0 ? null : quotes[recommended].company,
    recommended < 0 ? null : totals[recommended],
    toDate(c.date),
  ];
};

const QUOTE_GROUPS: Group[] = [
  {
    title: 'Comparison',
    color: RED,
    columns: [
      C('Quote Ref No.', 18),
      C('New / Renewal', 13, 'business'),
      C('Enquiry No.', 14),
      C('Client Name', 28),
      C('Insurance Line', 30),
      C('Business Activity', 24),
    ],
  },
  {
    title: 'Quote',
    color: '#6d28d9',
    columns: [
      C('Insurer', 26),
      C('Status', 13, 'status'),
      C('Deductible', 30),
      C('Premium Rate', 14),
      C('Geographical Limits', 20),
    ],
  },
  {
    title: 'Premium (AED)',
    color: '#15803d',
    columns: [
      C('Net Premium', 13, 'money'),
      C('Policy Fee', 11, 'money'),
      C('VAT', 11, 'money'),
      C('Total Premium', 14, 'money'),
      C('Cheapest in Comparison', 13, 'flag'),
    ],
  },
  {
    title: 'Record',
    color: '#4b5563',
    columns: [C('Created Date', 17, 'date')],
  },
];

const quoteRows = (c: SavedComparison): Value[][] => {
  const quotes = Array.isArray(c.quotes) ? c.quotes : [];
  const totals = quotes.map(totalOf);
  const priced = totals.filter((t): t is number => t !== null);
  const low = priced.length ? Math.min(...priced) : null;
  const type = businessType(c);

  return quotes.map((q, i) => [
    c.referenceNumber,
    type,
    enquiryNoOf(c),
    c.customerName,
    c.insuranceLine,
    c.businessActivity,
    q.company,
    q.isRecommended ? 'Recommended' : null,
    q.deductible,
    q.premiumRate,
    q.geographicalLimits,
    // A quote never filled in has nothing to report, not a premium of 0.
    totals[i] === null ? null : amount(q.premium),
    totals[i] === null ? null : amount(q.policyFee),
    totals[i] === null ? null : amount(q.vat),
    totals[i],
    totals[i] !== null && totals[i] === low ? 'Yes' : 'No',
    toDate(c.date),
  ]);
};

// ---------------------------------------------------------------------------
// Styling
// ---------------------------------------------------------------------------
const argb = (hex: string) => `FF${hex.replace('#', '').toUpperCase()}`;

// The band colour washed towards white, for the column-header row.
const tint = (hex: string, mixWithWhite = 0.82) => {
  const n = parseInt(hex.replace('#', ''), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * mixWithWhite);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(mix);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
};

const fill = (hex: string): Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: argb(hex) } });
const thin = (hex: string) => ({ style: 'thin' as const, color: { argb: argb(hex) } });
const box = (hex: string): Partial<Borders> => ({ top: thin(hex), left: thin(hex), bottom: thin(hex), right: thin(hex) });

const ZEBRA = '#faf4e6'; // every other data row
const GRID = '#e5e7eb';

// Coloured "pills" for the values a reader scans for: [fill, text].
const PILLS: Partial<Record<ColumnType, Record<string, [string, string]>>> = {
  business: { New: ['#dcfce7', '#166534'], Renewal: ['#fef3c7', '#92400e'] },
  flag: { Yes: ['#dcfce7', '#166534'] },
  status: { Recommended: ['#fef3c7', '#92400e'], Renewal: ['#dbeafe', '#1e40af'] },
};

const addDataSheet = (workbook: Workbook, name: string, groups: Group[], rows: Value[][]) => {
  const columns = groups.flatMap(g => g.columns.map(c => ({ ...c, group: g })));
  const ws = workbook.addWorksheet(name, {
    views: [{ state: 'frozen', xSplit: 1, ySplit: 2 }],
  });
  ws.columns = columns.map(c => ({ width: c.width }));

  // Row 1: one coloured band per group, merged across its columns.
  let col = 1;
  groups.forEach(g => {
    const first = col;
    const last = col + g.columns.length - 1;
    if (last > first) ws.mergeCells(1, first, 1, last);
    for (let c = first; c <= last; c++) {
      const band = ws.getCell(1, c);
      band.fill = fill(g.color);
      band.border = { left: thin('#ffffff'), right: thin('#ffffff') };
    }
    const cell = ws.getCell(1, first);
    cell.value = g.title.toUpperCase();
    cell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    col = last + 1;
  });
  ws.getRow(1).height = 24;

  // Row 2: column headers in a light tint of their group's colour.
  const header = ws.getRow(2);
  columns.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.value = c.header;
    cell.fill = fill(tint(c.group.color));
    cell.font = { bold: true, size: 10, color: { argb: argb(c.group.color) } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = { ...box(GRID), bottom: { style: 'medium', color: { argb: argb(c.group.color) } } };
  });
  header.height = 32;

  // Data rows.
  rows.forEach((values, r) => {
    const row = ws.getRow(r + 3);
    values.forEach((value, i) => {
      const c = columns[i];
      const cell = row.getCell(i + 1);
      // Empty means a truly empty cell, so Excel's blanks filter finds it.
      cell.value = value === undefined || value === '' ? null : value;
      cell.border = box(GRID);
      cell.alignment = { vertical: 'middle', horizontal: c.type === 'text' ? 'left' : 'center' };
      if (r % 2 === 1) cell.fill = fill(ZEBRA);

      if (c.type === 'money') {
        cell.numFmt = '#,##0.00';
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
      }
      if (c.type === 'date') cell.numFmt = 'dd/mm/yyyy hh:mm';
      if (i === 0) cell.font = { bold: true };

      const pill = typeof value === 'string' ? PILLS[c.type]?.[value] : undefined;
      if (pill) {
        cell.fill = fill(pill[0]);
        cell.font = { bold: true, color: { argb: argb(pill[1]) } };
      }
    });
  });

  ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: columns.length } };
  return ws;
};

// What the export covered, so a saved file explains itself.
const addInfoSheet = (workbook: Workbook, title: string, filters: ExportFilters, count: number) => {
  const ws = workbook.addWorksheet('Report Info');
  ws.columns = [{ width: 22 }, { width: 50 }];
  ws.mergeCells('A1:B1');
  const head = ws.getCell('A1');
  head.value = title;
  head.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  head.fill = fill(RED);
  head.alignment = { vertical: 'middle', indent: 1 };
  ws.getRow(1).height = 28;

  const lines: [string, Value][] = [
    ['Generated', localDate(new Date())],
    ['Period', filters.period],
    ['Insurance line', filters.insuranceLine],
    ['Search', filters.search || '—'],
    ['Rows', count],
    ['Premiums', 'Total payable per quote: net premium + policy fee + VAT'],
  ];
  lines.forEach(([label, value], i) => {
    const row = ws.getRow(i + 3);
    row.getCell(1).value = label;
    row.getCell(1).font = { bold: true, color: { argb: argb('#4b5563') } };
    row.getCell(2).value = value ?? '—';
    row.getCell(2).alignment = { horizontal: 'left' };
    if (value instanceof Date) row.getCell(2).numFmt = 'dd/mm/yyyy hh:mm';
  });
};

const buildWorkbook = async (
  sheetName: string,
  groups: Group[],
  rows: Value[][],
  title: string,
  filters: ExportFilters
) => {
  const mod = await import('exceljs');
  // The browser build is CommonJS; depending on the bundler's interop the
  // classes sit on the module itself or on its default export.
  const ExcelJS = (mod as unknown as { default?: typeof mod }).default ?? mod;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'NSIB General Insurance Quotes';
  workbook.created = new Date();
  addDataSheet(workbook, sheetName, groups, rows);
  addInfoSheet(workbook, title, filters, rows.length);

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
};

// One row per comparison.
export const buildComparisonsWorkbook = (comparisons: SavedComparison[], filters: ExportFilters) =>
  buildWorkbook('Comparisons', COMPARISON_GROUPS, comparisons.map(comparisonRow), 'GI Comparisons Report', filters);

// One row per insurer's quote inside those comparisons, for pivot tables.
export const buildQuotesWorkbook = (comparisons: SavedComparison[], filters: ExportFilters) =>
  buildWorkbook('Quotes', QUOTE_GROUPS, comparisons.flatMap(quoteRows), 'GI Quotes Report', filters);
