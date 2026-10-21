import { NextResponse } from 'next/server';
import { coql, ENQUIRY_MODULE, FOLDER_ID_FIELD, FOLDER_URL_FIELD } from '../../../lib/zoho';
import type { ZohoEnquiry } from '../../../lib/types';

export const dynamic = 'force-dynamic';

// GET /api/zoho/enquiries?q=<name or enquiry no.>
//
// Finds Zoho CRM enquiries for the comparison being built. A name matches when
// every word of it begins a word of the enquiry's contact name or enquiry name,
// in any order; "Enq298581" or just "298581" matches by enquiry number.
//
// This app has no sign-in, so anyone who can open it can call this. Only what
// the picker shows is returned — no premiums, commissions or notes — and only
// for a search of at least three characters, capped at MAX_RESULTS.

const MAX_RESULTS = 25;

// COQL has no bind parameters, so the search text is reduced to characters
// that can't break out of a quoted string or act as a wildcard.
const clean = (s: string | null) =>
  String(s || '')
    .replace(/[^\p{L}\p{N} .&-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);

const ENQUIRY_NO = /^(?:enq\s*)?(\d{3,})$/i;

// LLC, L.L.C, FZE, FZ-LLC, LTD, ... — with or without dots and dashes.
const COMPANY_SUFFIX = /^(?:l\.?l\.?c|f\.?z\.?e|fzco|fz-?llc|ltd|plc|inc|co|est|spc|opc)\.?$/i;

function whereClause(q: string) {
  const enq = q.match(ENQUIRY_NO);
  if (enq) return `Enquiry_No1 like '%${enq[1]}%'`;

  // Each word must START a word of the name: a plain substring match let "umar"
  // pull in every "Kumar". A word may also follow "(" — CRM names are written
  // "SHEEBA INTERIORS (L.L.C)". Three words is plenty to narrow and keeps the
  // query within COQL's limit on conditions.
  //
  // Company suffixes are dropped: CRM spells the same one "L.L.C", "(L.L.C)",
  // "(L.L.C", "L L C" and "LLC", so typing it ruled out the enquiry sought
  // while hardly narrowing the search. Kept only if nothing else was typed.
  const typed = q.split(' ').filter((w) => w.length >= 2);
  const named = typed.filter((w) => !COMPANY_SUFFIX.test(w));
  const words = (named.length ? named : typed).slice(0, 3);
  if (!words.length) return '';
  const all = (field: string) =>
    nest(
      words.map((w) => nest([`${field} like '${w}%'`, `${field} like '% ${w}%'`, `${field} like '%(${w}%'`], 'or')),
      'and'
    );
  return `(${all('Contact_Name.Full_Name')} or ${all('Deal_Name')})`;
}

// COQL rejects more than two conditions in one bracket ("a and b and c" is a
// syntax error), so chains are nested pairwise: ((a and b) and c).
const nest = (conds: string[], op: string) => conds.reduce((acc, c) => `(${acc} ${op} ${c})`);

export async function GET(request: Request) {
  try {
    const q = clean(new URL(request.url).searchParams.get('q'));
    if (q.length < 3) return NextResponse.json({ enquiries: [] });

    const where = whereClause(q);
    if (!where) return NextResponse.json({ enquiries: [] });
    // A typed enquiry number lists its exact match first, ahead of the other
    // numbers that merely contain those digits.
    const typedNo = (q.match(ENQUIRY_NO) || [])[1];
    const isTyped = (e: ZohoEnquiry) => !!typedNo && e.enquiryNo.toLowerCase() === `enq${typedNo}`;

    const rows = await coql(
      `select Enquiry_No1, Deal_Name, Contact_Name.Full_Name, ` +
        `Insurance_Type, Insurance_Sub_type, Enquiry_Date, Stage, ` +
        `${FOLDER_ID_FIELD}, ${FOLDER_URL_FIELD} ` +
        `from ${ENQUIRY_MODULE} where ${where} order by Created_Time desc limit ${MAX_RESULTS}`
    );

    // Ranked rather than filtered: the typed number first, then General
    // enquiries (this app's business), then the most recent.
    const enquiries: ZohoEnquiry[] = rows
      .map((r) => ({
        id: String(r.id),
        enquiryNo: r.Enquiry_No1 || '',
        enquiryName: r.Deal_Name || '',
        contactName: r['Contact_Name.Full_Name'] || '',
        insuranceType: r.Insurance_Type || '',
        subType: r.Insurance_Sub_type || '',
        enquiryDate: r.Enquiry_Date || '',
        stage: r.Stage || '',
        hasFolder: !!r[FOLDER_ID_FIELD],
        folderUrl: r[FOLDER_URL_FIELD] || '',
      }))
      .map((e, i) => ({ e, i }))
      .sort(
        (a, b) =>
          Number(isTyped(b.e)) - Number(isTyped(a.e)) ||
          Number(b.e.insuranceType === 'General') - Number(a.e.insuranceType === 'General') ||
          a.i - b.i
      )
      .map(({ e }) => e);

    return NextResponse.json({ enquiries });
  } catch (error) {
    console.error('Zoho enquiry search failed:', error);
    const message = error instanceof Error ? error.message : 'Zoho search failed.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
