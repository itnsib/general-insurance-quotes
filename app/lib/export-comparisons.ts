// ============================================================================
// Saved History export — the comparisons on screen, as an Excel workbook
// ============================================================================
// .xlsx in the NSIB theme (maroon, gold, sand, cream), laid out like the Motor
// tool's report: a title, two lines of notes saying what was exported and when,
// then a maroon header row with filters, frozen alongside the Ref No. column.
// Two layouts: one row per comparison (the report), or one row per insurer's
// quote (for pivot tables).
//
// exceljs is large, so it's loaded only when someone actually exports. The
// type-only import below is erased at build time and adds nothing to the bundle.

import type { Borders, Fill, Font, Workbook } from 'exceljs';
import type { Quote, SavedComparison } from './types';

// What the on-screen filters were, for the notes under the title.
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

// 16-Oct-2026 14:05, on the local clock.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const stamp = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}-${MONTHS[d.getMonth()]}-${d.getFullYear()} ` +
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

// ---------------------------------------------------------------------------
// Layouts
// ---------------------------------------------------------------------------
// text | int | money | date | flag (Yes/No) | business (New/Renewal) | status
type ColumnType = 'text' | 'int' | 'money' | 'date' | 'flag' | 'business' | 'status';
interface Column { header: string; width: number; type: ColumnType }

const C = (header: string, width: number, type: ColumnType = 'text'): Column => ({ header, width, type });

const COMPARISON_COLUMNS: Column[] = [
  C('Quote Ref No.', 18),
  C('New / Renewal', 15, 'business'),
  C('Insurance Line', 30),
  C('Enquiry No.', 14),
  C('Enquiry Name', 30),
  C('Insurance Type', 20),
  C('Client Name', 28),
  C('Business Activity', 24),
  C('Location / Risk Address', 28),
  C('Address', 28),
  C('Property Insured - Limit', 20),
  C('Quotes', 8, 'int'),
  C('Insurers Quoted', 30),
  C('Quotes Compared', 60),
  C('Lowest Premium (AED)', 15, 'money'),
  C('Highest Premium (AED)', 15, 'money'),
  C('Spread (AED)', 13, 'money'),
  C('Recommended Insurer', 28),
  C('Recommended Premium (AED)', 16, 'money'),
  C('Created Date', 17, 'date'),
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

const QUOTE_COLUMNS: Column[] = [
  C('Quote Ref No.', 18),
  C('New / Renewal', 15, 'business'),
  C('Enquiry No.', 14),
  C('Client Name', 28),
  C('Insurance Line', 30),
  C('Business Activity', 24),
  C('Insurer', 26),
  C('Status', 13, 'status'),
  C('Deductible', 30),
  C('Premium Rate', 14),
  C('Geographical Limits', 20),
  C('Net Premium (AED)', 14, 'money'),
  C('Policy Fee (AED)', 13, 'money'),
  C('VAT (AED)', 12, 'money'),
  C('Total Premium (AED)', 15, 'money'),
  C('Cheapest in Comparison', 13, 'flag'),
  C('Created Date', 17, 'date'),
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
// Styling — NSIB theme
// ---------------------------------------------------------------------------
const MAROON = '8A0E20';
const GOLD = 'D9A441';
const SAND = 'F0E4CC';
const CREAM = 'FAF6ED';
const INK = '2B2118';
const MUTED = '7A6A55';

const font = (color: string, extra: Partial<Font> = {}): Partial<Font> =>
  ({ name: 'Calibri', size: 10, color: { argb: `FF${color}` }, ...extra });
const fill = (hex: string): Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${hex}` } });
const thin = (hex: string) => ({ style: 'thin' as const, color: { argb: `FF${hex}` } });
const box = (hex: string): Partial<Borders> => ({ top: thin(hex), left: thin(hex), bottom: thin(hex), right: thin(hex) });

// Text goes in as a one-run rich-text value, which exceljs writes as an inline
// string: Excel shows it exactly as typed (Arabic included) and never reads a
// client name such as "=1+1" as a formula.
const text = (s: string) => ({ richText: [{ text: s }] });

// Rows above the table: title, two notes, a blank, then the header.
const HEADER_ROW = 5;
// Room for the filter arrow, so it doesn't sit over the heading.
const ARROW_ROOM = 3;

const addDataSheet = (
  workbook: Workbook,
  sheetName: string,
  title: string,
  columns: Column[],
  rows: Value[][],
  notes: [string, string]
) => {
  const ws = workbook.addWorksheet(sheetName, {
    views: [{ state: 'frozen', xSplit: 1, ySplit: HEADER_ROW, showGridLines: false }],
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      printTitlesRow: `${HEADER_ROW}:${HEADER_ROW}`,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.3, footer: 0.3 },
    },
    headerFooter: { oddFooter: `&L${title.replace(/&/g, '&&')}&RPage &P of &N` },
  });
  ws.columns = columns.map(c => ({ width: c.width + ARROW_ROOM }));

  // Row 1: the title. Rows 2–3: what this file holds and when it was made.
  const titleCell = ws.getCell(1, 1);
  titleCell.value = text(title);
  titleCell.font = font(MAROON, { size: 16, bold: true });
  ws.getRow(1).height = 24;
  notes.forEach((note, i) => {
    const cell = ws.getCell(2 + i, 1);
    cell.value = text(note);
    cell.font = font(MUTED, { size: 9 });
  });

  // The header row: white on maroon, gold rule underneath.
  const header = ws.getRow(HEADER_ROW);
  columns.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.value = text(c.header);
    cell.fill = fill(MAROON);
    cell.font = font('FFFFFF', { bold: true });
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = { ...box(SAND), bottom: { style: 'medium', color: { argb: `FF${GOLD}` } } };
  });
  header.height = 32;

  // Data rows: sand borders, every other row cream.
  rows.forEach((values, r) => {
    const row = ws.getRow(HEADER_ROW + 1 + r);
    values.forEach((value, i) => {
      const c = columns[i];
      const cell = row.getCell(i + 1);
      // Empty means a truly empty cell, so Excel's blanks filter finds it.
      cell.value =
        value === undefined || value === null || value === '' ? null
        : typeof value === 'string' ? text(value)
        : value;
      cell.font = font(INK, { bold: i === 0 });
      cell.border = box(SAND);
      if (r % 2 === 1) cell.fill = fill(CREAM);

      const short = c.type === 'business' || c.type === 'flag' || c.type === 'status' || c.type === 'int';
      cell.alignment = { vertical: 'middle', horizontal: short || c.type === 'date' ? 'center' : c.type === 'money' ? 'right' : 'left' };
      if (c.type === 'money') cell.numFmt = '#,##0.00';
      if (c.type === 'int') cell.numFmt = '0';
      if (c.type === 'date') cell.numFmt = 'dd-mmm-yyyy hh:mm';
    });
  });

  ws.autoFilter = { from: { row: HEADER_ROW, column: 1 }, to: { row: HEADER_ROW, column: columns.length } };
  return ws;
};

// exceljs's in-memory writer always collects text into a shared-strings table
// (its useSharedStrings option is only honoured by the streaming writer). Hand
// it an empty stand-in for that table instead: nothing is added, so each text
// cell — all rich text, see text() — is written as an inline string. Written
// against exceljs 4.4.0, which package.json pins.
const writeInlineStrings = (workbook: Workbook) => {
  const modelOf = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(workbook), 'model')?.get;
  if (!modelOf) return;
  const none = { add: () => undefined, count: 0, xml: '' };
  Object.defineProperty(workbook, 'model', {
    configurable: true,
    get() {
      const model = modelOf.call(this);
      Object.defineProperty(model, 'sharedStrings', { get: () => none, set: () => {} });
      return model;
    },
  });
};

const buildWorkbook = async (
  sheetName: string,
  title: string,
  columns: Column[],
  rows: Value[][],
  filters: ExportFilters,
  noun: string
) => {
  const mod = await import('exceljs');
  // The browser build is CommonJS; depending on the bundler's interop the
  // classes sit on the module itself or on its default export.
  const ExcelJS = (mod as unknown as { default?: typeof mod }).default ?? mod;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'NSIB General Insurance Quotes';
  workbook.created = new Date();

  const notes: [string, string] = [
    `Period: ${filters.period}  ·  Insurance line: ${filters.insuranceLine}  ·  ` +
      `Search: ${filters.search ? `"${filters.search}"` : 'none'}  ·  ${rows.length} ${noun}${rows.length === 1 ? '' : 's'}`,
    `Generated ${stamp(new Date())}  ·  Amounts in AED; premiums include policy fee and 5% VAT (no VAT on GLPA)`,
  ];
  addDataSheet(workbook, sheetName, title, columns, rows, notes);

  writeInlineStrings(workbook);
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
};

// One row per comparison.
export const buildComparisonsWorkbook = (comparisons: SavedComparison[], filters: ExportFilters) =>
  buildWorkbook(
    'Comparisons',
    'NSIB General Insurance - Saved Comparisons',
    COMPARISON_COLUMNS,
    comparisons.map(comparisonRow),
    filters,
    'comparison'
  );

// One row per insurer's quote inside those comparisons, for pivot tables.
export const buildQuotesWorkbook = (comparisons: SavedComparison[], filters: ExportFilters) =>
  buildWorkbook(
    'Quotes',
    'NSIB General Insurance - Quotes by Plan',
    QUOTE_COLUMNS,
    comparisons.flatMap(quoteRows),
    filters,
    'quote'
  );
