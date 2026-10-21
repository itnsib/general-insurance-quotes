// app/page.tsx
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import type { Quote, SavedComparison, WorkDriveResult, ZohoEnquiry } from './lib/types';
import EnquiryPicker from './components/EnquiryPicker';
import { workDriveNote } from './lib/zoho-client';
import { buildComparisonsWorkbook, buildQuotesWorkbook, localDay } from './lib/export-comparisons';
import { saveBlobAs } from './lib/save-file';
import { displayRate } from './lib/rate';

// ============ CONSTANTS ============
// Lines added 2026-10-21 with no standard wording yet: each quote opens with
// only Geographical Limits filled in, for the advisor to complete.
// A label is what a saved record stores (and how it is found again for
// editing), so these must not be renamed once comparisons exist under them.
const BLANK_LINE_COMPANIES = ['AWNIC', 'ADNTC', 'ARABIA'];
const BLANK_LINES = [
  { value: 'ear', label: 'Erection All Risk - Single' },
  { value: 'eei', label: 'Electronic Equipment Insurance' },
  { value: 'mb', label: 'Machinery Breakdown' },
  { value: 'bi', label: 'Business Interruption' },
  { value: 'marine-cargo', label: 'Marine Cargo' },
  { value: 'marine-hull', label: 'Marine Hull Insurance' },
  { value: 'home', label: 'Home Insurance' },
  { value: 'hotel', label: 'Hotel Comprehensive' },
  { value: 'mgit', label: 'Marine Goods in Transit - Annual' },
  { value: 'jewellers-block', label: 'Jewelers Block Insurance' },
  { value: 'airside', label: 'Airside Liability' },
  { value: 'med-mal', label: 'Medical Malpractice' },
  { value: 'el', label: 'Employers Liability' },
  { value: 'tour-operators', label: 'Tour Operators Liability' },
  { value: 'money', label: 'Money Insurance' },
  { value: 'fidelity', label: 'Fidelity Guarantee' },
  { value: 'ffl', label: 'Freight Forwarders Liability Insurance' },
  { value: 'cgl', label: 'Commercial General Liability' },
  { value: 'fire', label: 'Fire & Lightning Insurance' },
  { value: 'ship-repairs', label: 'Ship Repairs Legal Liability' }
];

const INSURANCE_LINES = [
  { value: 'sme', label: 'SME PACKAGE (PAR + TPL + WC EL)' },
  { value: 'par', label: 'PAR - Property All Risk Insurance' },
  { value: 'tpl', label: 'TPL - Third Party Liability Insurance' },
  { value: 'wcel', label: 'WC EL - Workmen\'s Compensation and Employer\'s Liability' },
  { value: 'car', label: 'CAR - Contractor\'s All Risk' },
  { value: 'cpm', label: 'CPM - Contractor\'s Plant and Machinery Insurance' },
  { value: 'glpa', label: 'GLPA - Group Life and Personal Accident Insurance' },
  { value: 'travel', label: 'TRAVEL - Travel Insurance' },
  { value: 'pi', label: 'PI - Professional Indemnity Insurance' },
  ...BLANK_LINES.map(({ value, label }) => ({ value, label }))
];

// Travel is quoted as four separate columns: three Qatar plans plus Orient.
// The order here is binding — it maps positionally onto TRAVEL_BENEFITS.values.
const TRAVEL_COMPANIES = [
  'Qatar Ins. Co. - Elite',
  'Qatar Ins. Co. - Premier',
  'Qatar Ins. Co. - Standard',
  'Orient Ins. Co.'
];

// Schedule of Benefits, transcribed verbatim from the travel comparison sheet.
// values[] is ordered [Elite, Premier, Standard, Orient] to match TRAVEL_COMPANIES.
// Values are strings because a single column mixes amounts, "Not Covered",
// "Included" and per-day/per-tooth wordings. Empty string = blank in the sheet,
// which is deliberately not the same as an explicit "Not Covered".
const TRAVEL_BENEFITS: { label: string; values: string[]; isHeader?: boolean }[] = [
  { label: 'A. Trip Cancellation / Curtailment', values: ['7500', '5000', 'Not Covered', '1000'] },
  { label: 'B. Emergency Medical and Other Expenses', values: ['1000000', '500000', '100000', '100000'] },
  { label: 'Transportation & Accommodation Expenses', values: ['$100 per day (Max $2,500)', '$50 per day (Max $1,500)', 'Not Covered', ''] },
  { label: 'Emergency Family Travel', values: ['1x Economy Ticket', '1x Economy Ticket', 'Not Covered', '1 x Economy Return Ticket'] },
  { label: 'Repatriation of the Deceased', values: ['15000', '10000', '7000', '7000'] },
  { label: 'Funeral Expenses', values: ['2000', '1000', '500', '750'] },
  { label: 'Dental Expenses', values: ['$200 per tooth (Max $1,500)', '$200 per tooth (Max $1,000)', '$200 per tooth (Max $500)', '$100 per tooth (Max $500)'] },
  { label: 'C. Personal Accident', values: ['', '', '', ''], isHeader: true },
  { label: 'Accidental Death or Dismemberment', values: ['150000', '100000', 'Not Covered', '25000'] },
  { label: 'Accidental Death (Common Carrier)', values: ['Included', 'Included', '50000', '25000'] },
  { label: 'Permanent Total Disablement', values: ['150000', '100000', 'Not Covered', '25000'] },
  { label: 'D. Missed Departure', values: ['1500', '1000', 'Not Covered', '250'] },
  { label: 'E. Travel Delay', values: ['$50 per hour up to $1,000', '$50 per hour up to $1,000', 'Not Covered', '$50 per 3 hour up to $500'] },
  { label: 'F. Personal Possessions', values: ['7000 (Max $1,250 per bag)', '5000 (Max $750 per bag)', 'Not Covered', ''] },
  { label: 'Valuables in total (See valuables definition) Single item limits apply.', values: ['500', '350', 'Not Covered', '$500 Per Item'] },
  { label: 'Single Item, Pair or Set', values: ['125', '75', 'Not Covered', '$100 Per Item'] },
  { label: 'Baggage Delay', values: ['$50 per hour up to $1,000', '$50 per hour up to $1,000', 'Not Covered', '$50 per 3 hours up to $500'] },
  { label: 'F.2 Personal Money & Documents', values: ['1000', '1000', '1000', '200'] },
  { label: 'Cash limit', values: ['500', '300', '200', '250'] },
  { label: 'Beach & Pool Cash limit', values: ['100', '100', '100', ''] },
  { label: 'F.3 Loss of Passport / Travel Documents', values: ['750', '500', 'Not Covered', ''] },
  { label: 'G. Travel Visa Rejection', values: ['100', '100', 'Not Covered', '100'] },
  { label: 'H. Personal Liability', values: ['1000000', '500000', 'Not Covered', '100000'] },
  { label: 'I. Legal Expenses', values: ['25000', '10000', 'Not Covered', '1000'] },
  { label: 'J. Bail Bond', values: ['10000', '5000', 'Not Covered', '1000'] },
  { label: 'K. Credit Card Fraud', values: ['1000', '500', 'Not Covered', '200'] },
  { label: 'L. Mugging', values: ['500', '500', 'Not Covered', '100'] }
];


// Insurance data extracted from Excel file
const INSURANCE_DEFAULTS: Record<string, any> = {
  "sme": {
    "companies": ["AIG", "RSA"],
    "scopeOfCover": "All assets of the Insured or property in the care, custody and control of the Insured or for which they hold themselves responsible in accordance with the Specification attaching hereto. This policy will indemnify the Insured for accidental physical loss of or damage to the Property Insured whilst situate at, in or on any Location",
    "geographicalLimits": "United Arab Emirates",
    "conditions": [
      "Including Legal and defense Costs cover. Any other type of accidental loss in our premises",
      "Workmen's Compensation as per UAE Labor Law / Employer's Liability as per Common and/or Sharia Law",
      "72 Hours Clause",
      "Reinstatement Value Clause",
      "Debris Removal Clause - Limited to 10% of Claim amount",
      "Including loss due to Riot, Strike and Civil Commotion",
      "Including fire explosion lightning, earthquake",
      "Storm, Flood, Tempest, Sand Storm"
    ],
    "exclusions": [
      "War Risks, Pollution Risk, Nuclear Risk",
      "Coronavirus exclusion - Communicable disease exclusion",
      "Property being worked upon",
      "Pure Financial Loss/ Consequential Loss"
    ],
    "deductible": "As per policy terms"
  },
  "par": {
    "companies": ["IH", "DNIRC", "RSA", "Orient UNB"],
    "scopeOfCover": "All assets of the Insured or property in the care, custody and control of the Insured or for which they hold themselves responsible in accordance with the Specification attaching hereto. This policy will indemnify the Insured for accidental physical loss of or damage to the Property Insured whilst situate at, in or on any Location",
    "geographicalLimits": "United Arab Emirates",
    "conditions": [
      "72 Hours Clause",
      "Reinstatement Value Clause",
      "Debris Removal Clause - Limited to 10% of Claim amount",
      "Including loss due to Riot, Strike and Civil Commotion",
      "Including fire explosion lightning, earthquake",
      "Storm, Flood, Tempest, Sand Storm",
      "Riot, Strike, Civil Commotion and labour or political disturbances"
    ],
    "exclusions": [
      "War Risks, Pollution Risk, Nuclear Risk",
      "Coronavirus exclusion - Communicable disease exclusion",
      "Property being worked upon",
      "Principals existing & surrounding properties",
      "Any offshore works / works on ships etc.",
      "Pure Financial Loss/ Consequential Loss"
    ],
    "deductible": "AED 2,500/- each and every loss\nFirst 3 days each and every loss in respect of loss of rent"
  },
  "tpl": {
    "companies": ["Sukoon", "IH", "AIG", "UNION"],
    "scopeOfCover": "To indemnify the insured against all sums up to the limit of indemnity specified under the policy which the insured shall become legally liable to pay as damages in respect of accidental bodily injury to any third party or to any third party property damage happening during the period of insurance arising out of their normal course of business activity anywhere within UAE",
    "geographicalLimits": "United Arab Emirates",
    "conditions": [
      "Including Legal and defense Costs cover. Any other type of accidental loss in our premises",
      "Product recall costs",
      "Cross liability clause",
      "Indemnity to principals clause"
    ],
    "exclusions": [
      "War Risks, Pollution Risk, Nuclear Risk",
      "Coronavirus exclusion - Communicable disease exclusion",
      "Product liability/defect",
      "Professional Indemnity",
      "Contractual liability",
      "Employer's liability"
    ],
    "deductible": "AED 2,500 each and every loss"
  },
  "wcel": {
    "companies": ["Sukoon", "IH", "AIG", "UNION"],
    "scopeOfCover": "To indemnify the Assured under Workmen's Compensation as per UAE Labor Law / Employer's Liability as per Common and/or Sharia Law",
    "geographicalLimits": "United Arab Emirates",
    "conditions": [
      "Workmen's Compensation as per UAE Labor Law / Employer's Liability as per Common and/or Sharia Law",
      "Coverage for all nationalities",
      "24 hours coverage worldwide",
      "Repatriation expenses",
      "Medical expenses coverage"
    ],
    "exclusions": [
      "War Risks, Pollution Risk, Nuclear Risk",
      "Coronavirus exclusion - Communicable disease exclusion",
      "Offshore workers",
      "Workers above 65 years",
      "Pre-existing medical conditions"
    ],
    "deductible": "NIL"
  },
  "car": {
    "companies": ["AIG", "IH", "RSA", "Orient UNB"],
    "scopeOfCover": "To indemnify the insured for accidental physical loss or damage to the contract works, construction plant and equipment, temporary buildings and other property for the completion of contract works including the period of maintenance",
    "geographicalLimits": "United Arab Emirates",
    "conditions": [
      "72 Hours Clause",
      "Reinstatement Value Clause",
      "Debris Removal Clause - Limited to 10% of Claim amount",
      "Including loss due to Riot, Strike and Civil Commotion",
      "Including fire explosion lightning, earthquake",
      "Storm, Flood, Tempest, Sand Storm",
      "Third Party Liability arising out of the contract works"
    ],
    "exclusions": [
      "War Risks, Pollution Risk, Nuclear Risk",
      "Coronavirus exclusion - Communicable disease exclusion",
      "Design defects",
      "Principals existing & surrounding properties",
      "Any offshore works / works on ships etc.",
      "Pure Financial Loss/ Consequential Loss"
    ],
    "deductible": "AED 5,000 each and every loss"
  },
  "cpm": {
    "companies": ["AIG", "IH", "RSA", "Orient UNB"],
    "scopeOfCover": "To indemnify the insured for accidental physical loss or damage to contractor's plant and machinery whilst on site and in transit within UAE",
    "geographicalLimits": "United Arab Emirates",
    "conditions": [
      "On site and in transit coverage",
      "Theft coverage",
      "Breakdown coverage",
      "Third party liability coverage"
    ],
    "exclusions": [
      "War Risks, Pollution Risk, Nuclear Risk",
      "Coronavirus exclusion - Communicable disease exclusion",
      "Mechanical/electrical breakdown",
      "Normal wear and tear",
      "Any offshore works / works on ships etc."
    ],
    "deductible": "AED 2,500 each and every loss"
  },
  "glpa": {
    "companies": ["ABNIC", "ALLIANCE"],
    "scopeOfCover": "To indemnify the Assured in respect of Group Life and Personal Accident benefits arising from Death due to any cause and Disability due to accident & sickness occurring during the policy period",
    "geographicalLimits": "24 hours Worldwide Cover On and Off duty",
    "conditions": [
      "24 hours Worldwide Cover On and Off duty",
      "Death Benefit: 100% of the sum insured",
      "Permanent Total Disability: 100% of the sum insured",
      "Permanent Partial Disability: Based on continental scale of benefits",
      "Temporary Total Disability: 100% weekly basic salary upto 52 weeks",
      "Medical Expenses: Covered upto AED 20,000",
      "Repatriation of Mortal Remains: Covered upto AED 20,000",
      "Funeral Expenses: Covered"
    ],
    "exclusions": [
      "Pre-existing conditions",
      "Self-inflicted injuries",
      "Nuclear weapons or devices or chemical or biological & mass destruction",
      "Active participation in war, civil war, terrorism & related political risk",
      "Offshore Risk"
    ],
    "deductible": "NIL"
  },
  "travel": {
    // Reuses TRAVEL_COMPANIES so the checkbox list, the default/custom split in
    // loadComparisonForEdit and the benefits columns can never disagree.
    "companies": TRAVEL_COMPANIES,
    "scopeOfCover": "To indemnify the Insured in respect of travel related losses including emergency medical expenses, trip cancellation or curtailment, personal accident, baggage and personal possessions, travel delay and personal liability arising during the insured journey, in accordance with the Schedule of Benefits attaching hereto.",
    "geographicalLimits": "Worldwide excluding country of residence (as per selected plan area)",
    "conditions": [
      "Cover operative from commencement of the insured journey until return to country of residence",
      "Benefits payable as per the Schedule of Benefits attaching to the policy",
      "24/7 emergency assistance helpline",
      "Emergency medical evacuation and repatriation included",
      "Maximum trip duration as per policy schedule"
    ],
    "exclusions": [
      "Pre-existing medical conditions",
      "War Risks, Nuclear Risk, Terrorism",
      "Self-inflicted injuries, suicide, alcohol or drug related claims",
      "Travel undertaken against medical advice",
      "Professional or hazardous sports and activities",
      "Travel to countries subject to sanctions or government travel bans",
      "Losses not reported to local authorities within 24 hours (baggage and money claims)"
    ],
    "deductible": "As per policy schedule"
  },
  "pi": {
    "companies": ["AWNIC", "ADNTC"],
    // Wording to follow — left blank so advisors fill it per quote until then.
    "scopeOfCover": "",
    "geographicalLimits": "United Arab Emirates",
    "conditions": [
      "Loss of Documents",
      "Dishonesty of Employees",
      "Libel and Slander",
      "Retroactive Clause -",
      "Cover is only in respect of the service rendered by insured UAE entity.",
      "Warranted no known or reported losses/ claims, nor circumstances that might lead to loss/claim and no material changes till date of binding"
    ],
    "exclusions": [
      "War & Civil War",
      "War and Terrorism Exclusion",
      "Total Asbestos Exclusion",
      "Excluding Any Cover for Loss Or Damage To Data",
      "Excluding Directors & Officers Liability",
      "Political Risks Exclusion Endorsement",
      "Excluding offshore / Marine activities / Wet Works / Breakwater",
      "Excluding Marine & Hull Liability / GIT / Freight Forwarders Liability",
      "Aviation / Airside Liability / Aerial Liability / Drones"
    ],
    "deductible": "AED 40,000/- each and every claim"
  },
  ...Object.fromEntries(BLANK_LINES.map(({ value }) => [value, {
    "companies": BLANK_LINE_COMPANIES,
    "scopeOfCover": "",
    "geographicalLimits": "United Arab Emirates",
    "conditions": [],
    "exclusions": [],
    "deductible": ""
  }]))
};

// ============ UTILITY FUNCTIONS ============
// Lines quoted without VAT: no VAT is added, and none is shown on the form or
// the comparison.
const isVatFreeLine = (lineValue: string) => lineValue === 'glpa' || lineValue === 'marine-cargo';

const calculateVAT = (premium: number, policyFee: number = 0, insuranceLine?: string) => {
  const subtotal = premium + policyFee;
  const vatRate = insuranceLine && isVatFreeLine(insuranceLine) ? 0 : 0.05;
  const vat = subtotal * vatRate;
  const total = subtotal + vat;
  return { vat: parseFloat(vat.toFixed(2)), total: parseFloat(total.toFixed(2)) };
};

// The id becomes the comparison's blob pathname, and the store is public — so
// the id is what keeps a record's URL unguessable. Math.random() is predictable
// from previous outputs, so it must not be the source here.
const generateId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
};

const generateReferenceNumber = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 9000) + 1000;
  return `GI-${year}${month}${day}-${random}`;
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getInsuranceCompanies = (lineValue: string): string[] => {
  return INSURANCE_DEFAULTS[lineValue]?.companies || [];
};

const getLineDefaults = (lineValue: string) => {
  return INSURANCE_DEFAULTS[lineValue] || {
    scopeOfCover: '',
    geographicalLimits: '',
    conditions: [],


    
    exclusions: [],
    deductible: ''
  };
};

const isTravelLine = (lineValue: string) => lineValue === 'travel';
// Lines priced per head, which carry Number of Employees.
const isEmployeeLine = (lineValue: string) => lineValue === 'glpa' || lineValue === 'wcel';
// Every line carries a Sum Insured; on these the premium is also calculated
// from it and the rate. PI is rated on its limit of indemnity, with no headcount.
const isRatedOnSumInsured = (lineValue: string) => isEmployeeLine(lineValue) || lineValue === 'pi';

// "AED 1,000,000", "1000000" or "1 million" -> 1000000. Null when there's no number.
const parseSumInsured = (value: string) => {
  const match = value.replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*(million|mn|m|thousand|k)?\b/i);
  if (!match) return null;
  const unit = match[2]?.toLowerCase();
  const scale = !unit ? 1 : unit === 'thousand' || unit === 'k' ? 1000 : 1000000;
  return parseFloat(match[1]) * scale;
};

// Premium from a rate per cent (basis 100) or per mille (basis 1000): "5" or
// "5%" on 1000 gives 1000 * 5 / 100 = 50; "5" per mille gives 5. Null when
// either side isn't a number yet, so a half-filled form leaves the premium alone.
const premiumFromRate = (sumInsured: string, premiumRate: string, basis: 100 | 1000 = 100) => {
  const si = parseSumInsured(sumInsured);
  const rate = premiumRate.replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  if (si === null || !rate) return null;
  return Math.round((si * parseFloat(rate[0]) * 100) / basis) / 100;
};

// The comparison is downloaded as a standalone .html file and opened from disk,
// so the cover page cannot reference /nsib-cover.png — from a file:// document
// that path resolves against the filesystem root, not the app. Inlining the
// image as a data URI keeps the download self-contained, so it still renders
// after it has been emailed on to a customer.
// The cover artwork with its six cards left empty. The copy is laid over it as
// live text rather than baked in, so it can be reflowed to fit the page exactly
// and edited without going back to the design file.
const COVER_IMAGE_PATH = '/nsib-cover-template.png';

// Positions are percentages of the cover sheet, so they hold at any page size.
// Each card has a gold divider near its foot in the artwork; the copy is centred
// in the space above it.
const COVER_BLURBS: { x: number; y: number; w: number; h: number; html: string }[] = [
  { x: 4.5, y: 20.5, w: 22.8, h: 20.1, html: 'With over 20 years of experience, New Shield Insurance Brokers delivers tailored protection that transforms risk into reassurance.' },
  { x: 72.7, y: 20.5, w: 22.8, h: 20.1, html: 'A team of 40 dedicated professionals offers clients expert service and a wide range of insurer products.' },
  { x: 4.5, y: 43.6, w: 22.8, h: 20.9, html: 'We compare multiple insurers to provide the best coverage at the right cost.' },
  { x: 72.7, y: 43.6, w: 22.8, h: 20.9, html: 'We work with over 40 channel partners as an insurance broker.' },
  { x: 4.5, y: 67.7, w: 22.8, h: 18.8, html: 'Proudly rated<br><span class="cover-rating"><span class="cover-stars">★★★★★</span> <strong>4.7</strong></span><br>on Google for service excellence.' },
  { x: 72.7, y: 67.7, w: 22.8, h: 18.8, html: 'We guide you through claims, handling insurers and paperwork to secure a fair, timely settlement.' }
];

const buildCoverPage = (dataUri: string | null) =>
  dataUri
    ? `    <section class="sheet cover-sheet" style="background-image:url(${dataUri})">
${COVER_BLURBS.map(b => `        <div class="cover-copy" style="left:${b.x}%;top:${b.y}%;width:${b.w}%;height:${b.h}%">${b.html}</div>`).join('\n')}
    </section>`
    : '';
const LOGO_IMAGE_PATH = '/nsib-logo.png';
const MASCOT_IMAGE_PATH = '/nsib-mascot.png';

// null is cached too: a brand asset that isn't in /public won't be re-requested
// on every download.
const imageCache = new Map<string, string | null>();

const loadImageAsDataUri = async (path: string): Promise<string | null> => {
  const cached = imageCache.get(path);
  if (cached !== undefined) return cached;

  try {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Server responded ${response.status}`);

    const blob = await response.blob();
    const dataUri = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });

    imageCache.set(path, dataUri);
    return dataUri;
  } catch (error) {
    // Never block the download over artwork — losing a branded element is
    // recoverable, losing a just-saved comparison is not. The element is
    // omitted rather than left as a broken image.
    console.error(`Failed to load ${path}, generating without it:`, error);
    imageCache.set(path, null);
    return null;
  }
};

// Insurer logos for the comparison column headers. Served from public/ (read
// from disk by the PDF server, inlined into the HTML fallback), rather than the
// external image hosts the IM and GMI
// tools use — a rotted link or a blocked host would otherwise leave a broken
// image in a document already sitting in a customer's inbox.
const INSURER_LOGOS: Record<string, string> = {
  // Short codes and trading names used by INSURANCE_DEFAULTS.
  'AIG': '/insurers/aig.png',
  'IH': '/insurers/insurance-house.jpg',
  'INSURANCE HOUSE': '/insurers/insurance-house.jpg',
  'DNIRC': '/insurers/dnirc.jpg',
  'ABNIC': '/insurers/al-buhaira.jpg',
  'AL BUHAIRA': '/insurers/al-buhaira.jpg',
  'UNION': '/insurers/union.jpg',
  'ALLIANCE': '/insurers/alliance.jpg',
  'AWNIC': '/insurers/awnic.jpg',
  'ARABIA': '/insurers/arabia.png',
  'ARABIAN SCANDINAVIAN': '/insurers/arabia.png',
  // "ORIENT UNB" and "Orient Ins. Co." both resolve here; the takaful arm is a
  // separate, longer key so it is matched first.
  'ORIENT TAKAFUL': '/insurers/orient-takaful.jpg',
  'ORIENT': '/insurers/orient.png',
  'QATAR GENERAL': '/insurers/qatar-general.jpg',
  'QATAR': '/insurers/qatar-insurance.png',
  'SUKOON TAKAFUL': '/insurers/sukoon-takaful.png',
  'SUKOON': '/insurers/sukoon.jpg',
  // Commonly added through "+ Add Company".
  'ADAMJEE': '/insurers/adamjee.jpg',
  'ADNIC': '/insurers/adnic.jpg',
  'ADNTC': '/insurers/adntc.jpg',
  'AFNIC': '/insurers/afnic.jpg',
  'AL AIN': '/insurers/al-ain.png',
  'AL ITTIHAD': '/insurers/al-ittihad.jpg',
  'AL SAGR': '/insurers/al-sagr.jpg',
  'AXA': '/insurers/axa.png',
  'CIGNA': '/insurers/cigna.jpg',
  'DAMAN': '/insurers/daman.png',
  'DAMANA': '/insurers/damana.jpg',
  'DIC': '/insurers/dic.jpg',
  'DUBAI INSURANCE': '/insurers/dic.jpg',
  'EMIRATES': '/insurers/emirates.jpg',
  'FIDELITY': '/insurers/fidelity.jpg',
  'GIG': '/insurers/gig.png',
  'HANSEMERKUR': '/insurers/hansemerkur.jpg',
  'LIVA': '/insurers/liva.jpg',
  'MAXHEALTH': '/insurers/maxhealth.jpg',
  'MEDGULF': '/insurers/medgulf.png',
  'METHAQ': '/insurers/methaq.jpg',
  'METLIFE': '/insurers/metlife.png',
  'NEW INDIA': '/insurers/new-india.png',
  'NGI': '/insurers/ngi.jpg',
  'RAK': '/insurers/rak.png',
  'SALAMA': '/insurers/salama.jpg',
  'SHARJAH': '/insurers/sharjah.jpg',
  'TAKAFUL EMARAT': '/insurers/takaful-emarat.png',
  'TOKIO': '/insurers/tokio.jpg',
  'WATANIA': '/insurers/watania.jpg'
};

// Exact match first, then longest-key-first substring matching, so a column
// headed "Qatar Ins. Co. - Elite" or "Orient UNB" still finds its logo and
// "SUKOON TAKAFUL" is never swallowed by the shorter "SUKOON" key.
const INSURER_LOGO_KEYS = Object.keys(INSURER_LOGOS).sort((a, b) => b.length - a.length);

const insurerLogoPath = (company: string): string | null => {
  if (!company) return null;

  const needle = company.toUpperCase().trim();
  if (INSURER_LOGOS[needle]) return INSURER_LOGOS[needle];

  const key = INSURER_LOGO_KEYS.find(candidate => needle.includes(candidate));
  return key ? INSURER_LOGOS[key] : null;
};

const loadDocumentAssets = async () => {
  const [cover, logo, mascot] = await Promise.all([
    loadImageAsDataUri(COVER_IMAGE_PATH),
    loadImageAsDataUri(LOGO_IMAGE_PATH),
    loadImageAsDataUri(MASCOT_IMAGE_PATH)
  ]);
  return { cover, logo, mascot };
};

// Only the insurers actually being compared are inlined, so a three-column
// comparison never carries the whole logo library.
const loadInsurerLogos = async (companies: string[]): Promise<Record<string, string>> => {
  const unique = Array.from(new Set(companies.filter(Boolean)));

  const entries = await Promise.all(
    unique.map(async company => {
      const path = insurerLogoPath(company);
      if (!path) return null;
      const dataUri = await loadImageAsDataUri(path);
      return dataUri ? ([company, dataUri] as const) : null;
    })
  );

  return Object.fromEntries(entries.filter(Boolean) as (readonly [string, string])[]);
};

// Turn a company name into its column in the benefits sheet. A company added via
// "+ Add Company" isn't in TRAVEL_COMPANIES, so it gets the full set of benefit
// labels with blank values — it still lines up row-for-row in the printed table.
const getTravelBenefits = (company: string) => {
  const columnIndex = TRAVEL_COMPANIES.indexOf(company);
  if (columnIndex === -1) {
    return TRAVEL_BENEFITS.map(row => ({ label: row.label, value: '' }));
  }
  return TRAVEL_BENEFITS.map(row => ({ label: row.label, value: row.values[columnIndex] ?? '' }));
};

// Small maroon outline glyphs shown beside each Particulars label. Drawn inline
// rather than loaded as files so the downloaded document stays self-contained.
const ICON_SHAPES: Record<string, string> = {
  shield: '<path d="M12 2l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V5z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 3.5 2.5 14.5 0 18M12 3c-2.5 3.5-2.5 14.5 0 18"/>',
  clipboard: '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9.5 4h5v3h-5z"/><path d="M9 11h6M9 15h6"/>',
  shieldCross: '<path d="M12 2l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V5z"/><path d="M9.6 9.6l4.8 4.8M14.4 9.6l-4.8 4.8"/>',
  percent: '<circle cx="8" cy="8" r="2.5"/><circle cx="16" cy="16" r="2.5"/><path d="M18 6L6 18"/>',
  trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  tag: '<path d="M3 12V4h8l9 9-8 8z"/><circle cx="7.5" cy="7.5" r="1.4"/>',
  document: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 12h6M9 16h4"/>',
  calculator: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8"/><path d="M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01"/>',
  receipt: '<path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 8h6M9 12h6"/>'
};

// Matched on the label text, not on a fixed row list, so a product with its own
// particulars (Marine, Fidelity Guarantee, ...) still picks up sensible icons.
// Order matters — the first match wins, so "Premium Rate" must be tested before
// the broader "premium" rule.
const ICON_RULES: { pattern: RegExp; shape: keyof typeof ICON_SHAPES }[] = [
  { pattern: /scope|cover(age)?$/i, shape: 'shield' },
  { pattern: /geograph|territor|jurisdict/i, shape: 'globe' },
  { pattern: /condition|extension|warrant/i, shape: 'clipboard' },
  { pattern: /exclusion|exception/i, shape: 'shieldCross' },
  { pattern: /deductible|excess|franchise/i, shape: 'percent' },
  { pattern: /rate/i, shape: 'trend' },
  { pattern: /premium/i, shape: 'tag' },
  { pattern: /fee|charge/i, shape: 'document' },
  { pattern: /vat|tax|levy/i, shape: 'calculator' },
  { pattern: /total|grand|payable/i, shape: 'receipt' }
];

// Browsers do not offer a line break after "/" or "-", so a long compound label
// ("Conditions/Extensions") would otherwise split mid-word in the narrow
// Particulars column. <wbr> marks the sensible break points instead.
const formatParticularLabel = (label: string) =>
  label
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/([/-])/g, '$1<wbr>');

const iconFor = (label: string) => {
  const shape = ICON_RULES.find(rule => rule.pattern.test(label))?.shape;
  // An unmatched particular falls back to the generic document glyph rather than
  // leaving a ragged column with some labels indented and some not.
  return `<svg class="p-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_SHAPES[shape ?? 'document']}</svg>`;
};

// Builds the <tbody> of the printed comparison table. Rows are assembled first
// and numbered afterwards, so inserting the travel benefits (or skipping the VAT
// row for a VAT-free line) can never desync the S.No column.
const buildComparisonRows = (comparison: SavedComparison, isVatFree: boolean, isTravel: boolean) => {
  const columnCount = comparison.quotes.length;

  type Row = {
    label: string;
    values: string[];
    isHeader?: boolean;
    isTotal?: boolean;
    // Set explicitly rather than inferred from the label: travel benefits like
    // "Permanent Total Disablement" contain financial words but are not
    // financial rows, and would otherwise be emphasised as if they were.
    isMoney?: boolean;
    // Travel repeats the same wording in every column for these rows, which in a
    // narrow column wraps to ~19 lines and pushes the table onto a third page.
    // Where all columns agree, print the text once across the full width.
    collapsible?: boolean;
  };

  const text = (value: any) => String(value ?? '');

  const rows: Row[] = [
    { label: 'Scope of Cover', values: comparison.quotes.map(q => text(q.scopeOfCover)), collapsible: true },
    { label: 'Geographical Limits', values: comparison.quotes.map(q => text(q.geographicalLimits)), collapsible: true },
    { label: 'Conditions/Extensions', values: comparison.quotes.map(q => q.conditions.filter(c => c.trim().length > 0).map(c => `• ${c}`).join('<br>')), collapsible: true },
    { label: 'Main Exclusions', values: comparison.quotes.map(q => q.exclusions.filter(e => e.trim().length > 0).map(e => `• ${e}`).join('<br>')), collapsible: true },
    { label: 'Deductible', values: comparison.quotes.map(q => text(q.deductible)), collapsible: true }
  ];

  if (isTravel) {
    // Use the first quote as the spine for row order, then match every other
    // column by label — so a company added via "+ Add Company" still lines up.
    const benefitLabels = comparison.quotes[0]?.benefits?.map(b => b.label) || [];
    benefitLabels.forEach(label => {
      rows.push({
        label,
        isHeader: TRAVEL_BENEFITS.find(t => t.label === label)?.isHeader,
        // Benefit figures are the whole point of the comparison — never collapsed,
        // so each plan's column stays readable even when two plans happen to match.
        values: comparison.quotes.map(q => text(q.benefits?.find(b => b.label === label)?.value))
      });
    });
  }

  rows.push(
    { label: 'Premium Rate', values: comparison.quotes.map(q => text(displayRate(q))) },
    { label: 'Premium (AED)', isMoney: true, values: comparison.quotes.map(q => text(q.premium)) },
    { label: 'Policy Fee (AED)', isMoney: true, values: comparison.quotes.map(q => text(q.policyFee)) }
  );

  if (!isVatFree) {
    rows.push({ label: 'VAT (5%)', isMoney: true, values: comparison.quotes.map(q => `AED ${q.vat}`) });
  }

  rows.push({
    label: 'Total (AED)',
    isTotal: true,
    values: comparison.quotes.map(q => `AED ${q.total}`)
  });

  rows.push({ label: 'Quote Validity', values: comparison.quotes.map(q => formatIsoDay(q.quoteValidity)) });

  let sno = 0;
  return rows.map(row => {
    // Section bands (e.g. "C. Personal Accident") span the full width and
    // don't consume an S.No.
    if (row.isHeader) {
      return `<tr class="section-row"><td class="sno"></td><td class="particulars" colspan="${columnCount + 1}">${row.label}</td></tr>`;
    }

    sno += 1;
    // Financial rows carry a little more weight than the wording rows above
    // them, and the total is the strongest line on the page.
    const rowClass = row.isTotal ? 'total-row' : row.isMoney ? 'money-row' : '';
    const rowAttr = rowClass ? ` class="${rowClass}"` : '';
    const lead = `<td class="sno">${sno}</td><td class="particulars"><span class="p-label">${iconFor(row.label)}<span>${formatParticularLabel(row.label)}</span></span></td>`;

    // Only merge when the collapse is lossless: every column carries identical text.
    const allMatch = columnCount > 1 && row.values.every(v => v === row.values[0]);
    if (isTravel && row.collapsible && allMatch) {
      return `<tr${rowAttr}>${lead}<td colspan="${columnCount}">${row.values[0]}</td></tr>`;
    }

    const cells = row.values.map((value, i) => {
      const cls = row.isTotal && comparison.quotes[i]?.isRecommended ? ' class="recommended"' : '';
      return `<td${cls}>${value}</td>`;
    }).join('');

    return `<tr${rowAttr}>${lead}${cells}</tr>`;
  }).join('');
};

// Travel prints ~36 rows. These overrides tighten the type and padding so the
// comparison still lands on as few sheets as possible after the cover page,
// without dropping below a readable size.
const TRAVEL_COMPACT_CSS = `
        .doc-title { font-size: 15pt; }
        .cmp-table { font-size: 7.6pt; }
        .cmp-table th { padding: 5px 3px; font-size: 7.6pt; }
        .cmp-table td { padding: 3px 5px; font-size: 7.6pt; line-height: 1.3; }
        .cmp-table .company-header { font-size: 8.4pt; }
        .p-label { gap: 4px; }
        .p-icon { width: 9px; height: 9px; }
        .total-row td { font-size: 8.6pt; }
        .advisor-note { font-size: 8pt; padding: 8px 10px; }
        .company-logo { max-height: 6mm; margin-bottom: 2px; }
`;

// ============ COMPARISON DOCUMENT (PRINT / PDF) ============
// The quotation document — cover sheet plus comparison — is emitted as one
// standalone HTML file. Both the generator and the saved-history list build it
// from here, so a comparison downloaded from either place is identical.

type DocumentAssets = {
  cover: string | null;
  logo: string | null;
  mascot: string | null;
  // Company name -> inlined logo. Insurers with no logo are simply absent.
  insurerLogos?: Record<string, string>;
};

// Row values already carry deliberate markup (bullet lists joined with <br>), so
// only operator-typed free text and insurer names are escaped — enough to stop a
// stray angle bracket in a company name from breaking the document it is
// emailed inside.
const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const FOOTER_ICON_SHAPES: Record<string, string> = {
  pin: '<path d="M12 21s7-6 7-11a7 7 0 10-14 0c0 5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a12 12 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  globe: ICON_SHAPES.globe
};

const footerIcon = (shape: keyof typeof FOOTER_ICON_SHAPES) =>
  `<svg class="f-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${FOOTER_ICON_SHAPES[shape]}</svg>`;

const DOCUMENT_CSS = `
        :root {
            --maroon: #6B1020;
            --maroon-deep: #4E0A16;
            --gold: #C08A2E;
            --gold-light: #DCC07A;
            --gold-pale: #F3E7C9;
            /* Sampled from the cover artwork so both pages sit on the same paper. */
            --cream: #FCF4EB;
            --ivory: #FFFEFA;
            --label-tint: #F5EADA;
            --ink: #2B2B2B;
        }

        * { box-sizing: border-box; }

        body {
            margin: 0;
            padding: 0;
            background: #EDE8DE;
            color: var(--ink);
            font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
            font-size: 10pt;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }

        /* One A4 portrait sheet. Height is deliberately not fixed, so a long
           comparison flows onto further sheets instead of being clipped. */
        .sheet {
            width: 210mm;
            min-height: 297mm;
            margin: 8mm auto;
            padding: 11mm 12mm 0;
            background: var(--cream);
            border: 1px solid #E3D9C4;
            box-shadow: 0 6px 24px rgba(0,0,0,0.12);
            position: relative;
            overflow: hidden;
        }

        /* Exactly one A4 sheet, edge to edge. The artwork is drawn at A4
           proportions (1055x1491, within 0.1% of 1:1.4142) and bleeds to its own
           edges with no white margin, so 100% 100% fills the sheet exactly:
           nothing is cropped, nothing is letterboxed, and the residual stretch
           is far below anything visible. */
        .cover-sheet {
            position: relative;
            width: 210mm;
            height: 297mm;
            min-height: 0;
            margin: 0 auto;
            padding: 0;
            border: 0;
            box-shadow: none;
            overflow: hidden;
            background-repeat: no-repeat;
            background-position: center;
            background-size: 100% 100%;
            page-break-after: always;
        }
        /* Copy sits in the artwork's empty cards. Flex-centred so a short line
           and a five-line paragraph both sit correctly in the same card. The
           bottom padding lifts the text clear of the gold divider drawn near
           each card's foot. */
        .cover-copy {
            position: absolute;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 0 4mm 6mm;
            color: #3A2A22;
            font-size: 9pt;
            line-height: 1.45;
        }
        .cover-copy strong { font-weight: 700; color: #2B2B2B; }
        .cover-stars { color: #2E9E5B; letter-spacing: 1px; }
        /* Keep the stars and the score on one line, as in the artwork. */
        .cover-rating { white-space: nowrap; }

        /* ---------- Header ---------- */
        .doc-header {
            display: grid;
            grid-template-columns: 34mm 1fr 34mm;
            align-items: center;
            gap: 5mm;
            position: relative;
            z-index: 1;
        }
        /* Both marks are constrained by height so they optically match each
           other regardless of their differing aspect ratios. */
        .brand-logo, .brand-mascot { max-width: 100%; max-height: 26mm; height: auto; display: block; }
        .brand-logo { justify-self: start; }
        .brand-mascot { justify-self: end; }
        .brand-name { text-align: center; }
        .brand-name-main {
            display: block;
            font-size: 26pt;
            font-weight: 800;
            letter-spacing: 0.5px;
            color: #111111;
            line-height: 1.05;
        }
        .brand-name-sub {
            display: block;
            font-size: 13pt;
            font-weight: 600;
            letter-spacing: 0.4px;
            color: #1B1B1B;
        }

        /* ---------- Gold rule with centre diamond ---------- */
        .gold-rule { display: flex; align-items: center; justify-content: center; gap: 8px; margin: 3.5mm 0; }
        .gold-rule .line { flex: 1; height: 1px; background: linear-gradient(90deg, transparent, var(--gold-light), var(--gold)); }
        .gold-rule .line:last-child { background: linear-gradient(90deg, var(--gold), var(--gold-light), transparent); }
        .gold-rule .diamond { width: 6px; height: 6px; background: var(--gold); transform: rotate(45deg); flex: none; }
        .gold-rule .diamond.small { width: 4px; height: 4px; background: var(--gold-light); }

        /* ---------- Title ---------- */
        /* Deliberately not boxed — the title sits on the cream sheet with a gold
           rule beneath it, matching the Individual Medical template. */
        .doc-title {
            margin: 0;
            text-align: center;
            font-size: 17pt;
            font-weight: 700;
            line-height: 1.3;
            letter-spacing: 0.3px;
            color: var(--maroon);
            text-transform: uppercase;
        }

        /* ---------- Quote reference / date ---------- */
        .quote-meta {
            display: flex;
            align-items: center;
            justify-content: center;
            flex-wrap: wrap;
            gap: 2mm 10mm;
            margin-bottom: 4.5mm;
            font-size: 10.5pt;
        }
        .quote-meta strong { color: var(--maroon); font-weight: 700; }
        .quote-meta .divider { width: 1px; height: 14px; background: var(--gold); }

        /* ---------- Client details ---------- */
        .client-details {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1.5mm 8mm;
            margin: -1.5mm 0 4.5mm;
            padding: 7px 12px;
            background: var(--ivory);
            border: 1px solid var(--gold-light);
            font-size: 9.5pt;
        }
        .client-details .cd-label { color: var(--ink); }
        .client-details strong { color: var(--maroon); font-weight: 700; }

        /* ---------- Comparison table ---------- */
        .cmp-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            font-size: 9pt;
            background: var(--ivory);
        }
        .cmp-table thead th {
            padding: 6px 5px;
            text-align: center;
            font-weight: 700;
            color: #FFFFFF;
            border: 1px solid rgba(255,255,255,0.25);
            vertical-align: middle;
        }
        /* The .sno/.particulars body rules below set a dark colour, and being
           later in the sheet at equal specificity they would otherwise repaint
           the header labels dark-on-maroon. Re-assert white here. */
        .cmp-table thead .sno, .cmp-table thead .particulars { background: var(--maroon); color: #FFFFFF; }
        .cmp-table thead .sno { font-size: 8pt; }
        /* White, as in the Individual Medical template: insurer logos are drawn
           for a white ground, and most of these files carry their own white
           background, so anything else frames them in torn rectangles. */
        .cmp-table thead .company-header {
            background: #FFFFFF;
            color: var(--maroon-deep);
            font-size: 10pt;
            letter-spacing: 0.3px;
            line-height: 1.25;
            border-color: #EADFC4;
        }
        /* Bounded by max-width/max-height rather than a fixed box, so layout
           does the scaling and every logo keeps its true aspect ratio. */
        .company-logo {
            display: block;
            max-width: 100%;
            max-height: 9mm;
            width: auto;
            height: auto;
            margin: 0 auto 3px;
        }
        .company-name { display: block; font-weight: 700; }

        .cmp-table td {
            padding: 4.5px 8px;
            border: 1px solid #EADFC4;
            vertical-align: top;
            line-height: 1.45;
            word-wrap: break-word;
            overflow-wrap: break-word;
        }
        .cmp-table tbody tr:nth-child(even) td { background: #FDFAF2; }
        .cmp-table .sno { text-align: center; font-weight: 700; color: var(--maroon); }
        .cmp-table .particulars { font-weight: 700; color: var(--maroon-deep); }
        /* The benefit label column carries its own warm tint so it reads as a
           spine down the page, as in the Individual Medical template. Specific
           enough to beat the striping rule above; the section and total bands
           still override it, so those stay full-width. */
        .cmp-table tbody tr td.sno,
        .cmp-table tbody tr td.particulars { background: var(--label-tint); }

        .p-label { display: flex; align-items: flex-start; gap: 6px; color: var(--maroon); min-width: 0; }
        /* Fixed box and flex:none keep the glyph from stretching the row or
           squeezing a long label. */
        .p-icon { width: 11px; height: 11px; flex: none; margin-top: 1px; }
        /* A flex child will not shrink below its longest word by default, so a
           single-token label ("Conditions/Extensions") would spill into the
           neighbouring insurer column. Allow it to break anywhere. */
        .p-label > span { color: var(--maroon-deep); min-width: 0; overflow-wrap: break-word; }

        .section-row td { background: var(--gold-pale) !important; color: var(--maroon); font-weight: 700; letter-spacing: 0.3px; }

        .money-row td { font-weight: 600; }
        .total-row td {
            background: var(--gold-pale) !important;
            color: var(--maroon);
            font-weight: 800;
            font-size: 11pt;
            border-top: 1.5px solid var(--gold);
            border-bottom: 1.5px solid var(--gold);
        }
        .recommended { box-shadow: inset 0 0 0 2px var(--gold); }

        /* ---------- Advisor note ---------- */
        .advisor-note {
            margin-top: 4mm;
            padding: 9px 12px;
            background: var(--ivory);
            border: 1px solid var(--gold-light);
            border-left: 3px solid var(--maroon);
            font-size: 9pt;
            page-break-inside: avoid;
        }
        .advisor-note h4 { margin: 0 0 4px; font-size: 9.5pt; color: var(--maroon); letter-spacing: 0.3px; text-transform: uppercase; }
        .advisor-note p { margin: 0; line-height: 1.5; }

        .disclaimer {
            margin: 4mm 0 0;
            font-size: 8pt;
            font-style: italic;
            line-height: 1.45;
            color: #5A4A40;
            page-break-inside: avoid;
        }
        .disclaimer strong { font-style: normal; color: var(--maroon); }

        /* ---------- Footer ---------- */
        .doc-footer {
            margin: 6mm -12mm 0;
            padding: 4mm 12mm 5mm;
            background: linear-gradient(180deg, var(--maroon) 0%, var(--maroon-deep) 100%);
            color: #F6EEDD;
            page-break-inside: avoid;
        }
        .footer-banner { display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 4mm; }
        .footer-banner .text { font-size: 10.5pt; font-weight: 700; letter-spacing: 1.2px; color: var(--gold-light); white-space: nowrap; }
        .footer-banner .line { width: 18mm; height: 1px; background: var(--gold); opacity: 0.8; }
        .footer-banner .diamond { width: 5px; height: 5px; background: var(--gold); transform: rotate(45deg); }

        .footer-grid { display: grid; grid-template-columns: 1.35fr 1fr 1fr; gap: 8mm; align-items: start; }
        .footer-col { display: flex; gap: 7px; font-size: 8.5pt; line-height: 1.5; }
        .footer-col + .footer-col { border-left: 1px solid rgba(220,192,122,0.35); padding-left: 8mm; }
        .footer-stack { display: flex; flex-direction: column; gap: 3mm; }
        .footer-row { display: flex; gap: 7px; }
        .footer-label { color: var(--gold-light); font-weight: 600; }
        .f-icon { width: 12px; height: 12px; flex: none; margin-top: 2px; color: var(--gold); }

        /* ---------- Print ---------- */
        @page { size: A4 portrait; margin: 10mm; }

        @media print {
            body { background: #FFFFFF; }
            .sheet {
                width: auto;
                min-height: 0;
                margin: 0;
                padding: 0;
                border: 0;
                box-shadow: none;
                overflow: visible;
            }
            .doc-footer { margin-left: 0; margin-right: 0; padding-left: 8mm; padding-right: 8mm; }
            /* Repeat the column headers whenever the comparison runs on. */
            .cmp-table thead { display: table-header-group; }
            .cmp-table tr { page-break-inside: avoid; }
            /* Bleed out over the page margin so the cover prints edge to edge on
               all four sides. A named @page with margin:0 would be tidier, but
               Chrome applies a named page's size to every page in the document,
               which shrinks the comparison sheets too. */
            .cover-sheet {
                margin: -10mm;
                width: 210mm;
                height: 297mm;
                page-break-after: always;
            }
        }
`;

const buildDocumentHeader = (assets: DocumentAssets) => `
    <header class="doc-header">
        ${assets.logo ? `<img class="brand-logo" src="${assets.logo}" alt="New Shield Insurance Brokers L.L.C." />` : '<span></span>'}
        <div class="brand-name">
            <span class="brand-name-main">NEW SHIELD</span>
            <span class="brand-name-sub">INSURANCE BROKERS L.L.C.</span>
        </div>
        ${assets.mascot ? `<img class="brand-mascot" src="${assets.mascot}" alt="" />` : '<span></span>'}
    </header>
    <div class="gold-rule"><span class="line"></span><span class="diamond small"></span><span class="diamond"></span><span class="diamond small"></span><span class="line"></span></div>`;

const DOCUMENT_FOOTER = `
        <footer class="doc-footer">
            <div class="footer-banner">
                <span class="line"></span><span class="diamond"></span>
                <span class="text">YOUR INSURANCE CHANNEL PARTNER</span>
                <span class="diamond"></span><span class="line"></span>
            </div>
            <div class="footer-grid">
                <div class="footer-col">
                    ${footerIcon('pin')}
                    <div>
                        Suite 2801, One by Omniyat<br>
                        Al Mustaqbal Street, Business Bay, Dubai, U.A.E.<br>
                        P.O Box 233640<br>
                        UAE Central Bank Registration Number: 200
                    </div>
                </div>
                <div class="footer-col">
                    <div class="footer-stack">
                        <div class="footer-row">
                            ${footerIcon('phone')}
                            <div><span class="footer-label">Call us on</span><br>047058000</div>
                        </div>
                        <div class="footer-row">
                            ${footerIcon('mail')}
                            <div>enquiry@nsib.ae</div>
                        </div>
                    </div>
                </div>
                <div class="footer-col">
                    ${footerIcon('globe')}
                    <div><span class="footer-label">Visit our website</span><br>www.nsib.ae</div>
                </div>
            </div>
        </footer>`;

// Formats to the dd/mm/yyyy shown on the quotation. Saved records hold an ISO
// timestamp, but a hand-edited record could hold anything, so an unparseable
// value falls back to its date portion rather than rendering "Invalid Date".
const formatQuoteDate = (value: string) => {
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? value.substring(0, 10) : parsed.toLocaleDateString('en-GB');
};

// A date picker's yyyy-mm-dd as dd/mm/yyyy. Split by hand rather than parsed,
// which would read it as UTC midnight and could print the previous day.
const formatIsoDay = (value?: string) => {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value || '';
};

const formatPolicyPeriod = (from?: string, to?: string) => {
  if (!from && !to) return '';
  return `${formatIsoDay(from) || '—'} – ${formatIsoDay(to) || '—'}`;
};

// yyyy-mm-dd + 1 year − 1 day, e.g. 2026-11-01 → 2027-10-31. Worked in UTC so
// the local timezone can't shift the day. '' for an empty or invalid start.
const oneYearPolicyEnd = (from: string) => {
  const match = from.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '';
  const end = new Date(Date.UTC(+match[1] + 1, +match[2] - 1, +match[3] - 1));
  return end.toISOString().slice(0, 10);
};

// The date pickers show the browser's own format (often mm/dd/yyyy), so the
// period is repeated underneath unambiguously, with its length.
const policyPeriodHint = (from: string, to: string) => {
  const day = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  if (!from || !to) return `${from ? day(from) : '…'} – ${to ? day(to) : '…'}`;
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
  if (days < 1) return '⚠️ The end date is before the start date.';
  const length = to === oneYearPolicyEnd(from) ? '1 year' : `${days} days`;
  return `${day(from)} – ${day(to)} · ${length}`;
};

// Printed on every comparison, whatever the line.
const COMPARISON_DISCLAIMER = "This comparison is based on the quotations received and is subject to the insurers' final terms, conditions, and policy wordings. Coverage differences should be reviewed before making a final decision.";

const buildClientDetails = (comparison: SavedComparison) => {
  const details: [string, string | undefined][] = [
    ['Client Name', comparison.customerName],
    ['Policy Period', formatPolicyPeriod(comparison.policyFrom, comparison.policyTo)],
    ['Sum Insured', comparison.totalSumInsured || comparison.propertyLimit],
    ['No. of Employees', comparison.numberOfEmployees]
  ];
  const cells = details
    .filter(([, value]) => value && value.trim())
    .map(([label, value]) => `<div><span class="cd-label">${label}:</span> <strong>${escapeHtml(value!)}</strong></div>`)
    .join('');
  return cells ? `<div class="client-details">${cells}</div>` : '';
};

const buildComparisonDocument = (comparison: SavedComparison, assets: DocumentAssets) => {
  // Saved records hold the line's label. The GLPA text match also catches
  // records saved under an older wording of that label.
  const isGLPA = comparison.insuranceLine.includes('GLPA') || comparison.insuranceLine.includes('Group Life');
  const lineValue = INSURANCE_LINES.find(line => line.label === comparison.insuranceLine)?.value || '';
  const isVatFree = isGLPA || isVatFreeLine(lineValue);
  const isTravel = comparison.insuranceLine.includes('TRAVEL');
  const tableBody = buildComparisonRows(comparison, isVatFree, isTravel);

  const columnCount = comparison.quotes.length;
  // Insurer columns share whatever the two fixed columns leave, so 2, 3 or 6
  // insurers all produce even columns rather than a ragged table.
  const insurerWidth = columnCount > 0 ? (72 / columnCount).toFixed(3) : '72';
  // Step the body type down as columns are added instead of letting a wide
  // comparison overflow the sheet. The floor is 7.4pt — still legible in print.
  const bodyFont = columnCount <= 3 ? 9 : columnCount === 4 ? 8.4 : columnCount === 5 ? 7.9 : 7.4;

  const title = `${comparison.insuranceLine.toUpperCase()} - INSURANCE COMPARISON`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(comparison.insuranceLine)} - Insurance Comparison</title>
    <style>
${DOCUMENT_CSS}
        .cmp-table { font-size: ${bodyFont}pt; }
${isTravel ? TRAVEL_COMPACT_CSS : ''}
    </style>
</head>
<body>
${buildCoverPage(assets.cover)}

    <section class="sheet comparison-sheet">
${buildDocumentHeader(assets)}

        <h1 class="doc-title">${escapeHtml(title)}</h1>
        <div class="gold-rule"><span class="line"></span><span class="diamond"></span><span class="line"></span></div>

        <div class="quote-meta">
            <span>Quote Ref: <strong>${escapeHtml(comparison.referenceNumber)}</strong></span>
            <span class="divider"></span>
            ${comparison.enquiryNumber ? `<span>Enquiry No: <strong>${escapeHtml(comparison.enquiryNumber)}</strong></span>
            <span class="divider"></span>
            ` : ''}<span>Date: <strong>${escapeHtml(formatQuoteDate(comparison.date))}</strong></span>
        </div>

        ${buildClientDetails(comparison)}

        <table class="cmp-table">
            <colgroup>
                <col style="width:6%">
                <col style="width:22%">
                ${comparison.quotes.map(() => `<col style="width:${insurerWidth}%">`).join('')}
            </colgroup>
            <thead>
                <tr>
                    <th class="sno">S.No.</th>
                    <th class="particulars">Particulars</th>
                    ${comparison.quotes.map(quote => {
                      const logo = assets.insurerLogos?.[quote.company];
                      return `<th class="company-header">${
                        logo ? `<img class="company-logo" src="${logo}" alt="${escapeHtml(quote.company)}" />` : ''
                      }<span class="company-name">${escapeHtml(quote.company)}</span></th>`;
                    }).join('')}
                </tr>
            </thead>
            <tbody>${tableBody}</tbody>
        </table>

        ${comparison.remarks?.trim() ? `
        <div class="advisor-note">
            <h4>Remarks</h4>
            <p>${escapeHtml(comparison.remarks).replace(/\n/g, '<br>')}</p>
        </div>` : ''}

        ${comparison.advisorComment?.trim() ? `
        <div class="advisor-note">
            <h4>Advisor Comment</h4>
            <p>${escapeHtml(comparison.advisorComment).replace(/\n/g, '<br>')}</p>
        </div>` : ''}

        <p class="disclaimer"><strong>Note:</strong> ${escapeHtml(COMPARISON_DISCLAIMER)}</p>

${DOCUMENT_FOOTER}
    </section>
</body>
</html>`;
};

const saveBlob = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
};

// The document's images as site paths, for the PDF server, which answers them
// from public/ (see app/lib/pdf.ts) — so the request carries no image data and
// stays far below Vercel's 4.5 MB body limit.
//
// The brand artwork comes from public/pdf/: copies scaled to what the page
// prints (about three times its printed size) and the cover as JPEG. The
// originals would put 2.4 MB of images into every PDF, pressing the download
// against Vercel's 4.5 MB response limit for no visible gain.
const pdfAssets = (comparison: SavedComparison): DocumentAssets => ({
  cover: '/pdf/nsib-cover.jpg',
  logo: '/pdf/nsib-logo.png',
  mascot: '/pdf/nsib-mascot.png',
  insurerLogos: Object.fromEntries(
    comparison.quotes
      .map(q => [q.company, insurerLogoPath(q.company)] as const)
      .filter((entry): entry is readonly [string, string] => !!entry[1])
  )
});

// Asks the server to turn the document into a PDF. With an enquiry, the server
// also files it in that enquiry's WorkDrive, and with workdriveOnly it answers
// with the filing outcome instead of the file.
const requestPdf = (comparison: SavedComparison, enquiry: ZohoEnquiry | null, workdriveOnly = false) =>
  fetch('/api/render-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      html: buildComparisonDocument(comparison, pdfAssets(comparison)),
      filename: `insurance_comparison_${comparison.referenceNumber}.pdf`,
      enquiryId: enquiry?.id,
      reference: comparison.referenceNumber,
      workdriveOnly
    })
  });

// Downloads the comparison as a PDF and, unless `fileIt` is false, files the
// same PDF in WorkDrive when the comparison is linked to a Zoho enquiry.
// Returns the WorkDrive outcome (null when nothing was filed).
const downloadComparisonDocument = async (
  comparison: SavedComparison,
  { fileIt = true }: { fileIt?: boolean } = {}
): Promise<WorkDriveResult | null> => {
  const filename = `insurance_comparison_${comparison.referenceNumber}`;
  const enquiry = fileIt ? comparison.enquiry ?? null : null;

  try {
    const response = await requestPdf(comparison, enquiry);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || `PDF server responded ${response.status}`);
    }
    const header = response.headers.get('X-WorkDrive-Result');
    saveBlob(await response.blob(), `${filename}.pdf`);
    return header ? (JSON.parse(decodeURIComponent(header)) as WorkDriveResult) : null;
  } catch (error) {
    // A failed PDF should not cost the advisor the document, so fall back to
    // the self-contained HTML, which every browser can print to PDF.
    console.error('PDF export failed, falling back to HTML download:', error);
    const [assets, insurerLogos] = await Promise.all([
      loadDocumentAssets(),
      loadInsurerLogos(comparison.quotes.map(q => q.company))
    ]);
    const htmlContent = buildComparisonDocument(comparison, { ...assets, insurerLogos });
    saveBlob(new Blob([htmlContent], { type: 'text/html' }), `${filename}.html`);
    return enquiry ? { ok: false, error: 'the PDF server was unavailable, so an HTML copy was downloaded instead.' } : null;
  }
};

// Files the comparison's PDF in its enquiry's WorkDrive, with nothing downloaded.
const saveComparisonToWorkDrive = async (comparison: SavedComparison): Promise<WorkDriveResult> => {
  if (!comparison.enquiry) return { ok: false, error: 'Link a Zoho enquiry first.' };
  try {
    const response = await requestPdf(comparison, comparison.enquiry, true);
    const body = await response.json().catch(() => ({}));
    return body.workdrive || { ok: false, error: body.error || `PDF server responded ${response.status}.` };
  } catch {
    return { ok: false, error: 'The PDF server is unavailable. Check your connection.' };
  }
};

// Compact field styling for the Client & Policy Details block.
const DETAIL_LABEL = 'block text-xs font-bold mb-0.5 text-gray-800';
const DETAIL_INPUT = 'w-full px-2 py-1.5 text-sm border-2 border-gray-300 rounded text-gray-900 bg-white focus:border-indigo-500 focus:outline-none';

// ============ QUOTE GENERATOR PAGE ============
function QuoteGeneratorPage({ 
  onSaveComplete, 
  editComparison, 
  onCancelEdit 
}: { 
  onSaveComplete?: (comparison: SavedComparison, workdrive?: WorkDriveResult | null) => void;
  editComparison?: SavedComparison | null;
  onCancelEdit?: () => void;
}) {
  const [insuranceLine, setInsuranceLine] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [address, setAddress] = useState('');
  const [businessActivity, setBusinessActivity] = useState('');
  const [location, setLocation] = useState('');
  const [totalSumInsured, setTotalSumInsured] = useState('');
  const [numberOfEmployees, setNumberOfEmployees] = useState('');
  const [policyFrom, setPolicyFrom] = useState('');
  const [policyTo, setPolicyTo] = useState('');
  const [remarks, setRemarks] = useState('');
  const [enquiryNumber, setEnquiryNumber] = useState('');
  // The Zoho CRM enquiry this comparison belongs to. When set, its PDF is also
  // filed in that enquiry's WorkDrive folder.
  const [enquiry, setEnquiry] = useState<ZohoEnquiry | null>(null);
  const [advisorComment, setAdvisorComment] = useState('');
  
  const [availableCompanies, setAvailableCompanies] = useState<string[]>([]);
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  
  // New state for dynamic companies and editable content
  const [customCompanies, setCustomCompanies] = useState<string[]>([]);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [showAddCompany, setShowAddCompany] = useState(false);
  
  // Edit functionality state
  const [isEditing, setIsEditing] = useState(false);
  const [editingComparison, setEditingComparison] = useState<SavedComparison | null>(null);
  const [saving, setSaving] = useState(false);
  // "Save to WorkDrive" in progress, and what the last one came to.
  const [filing, setFiling] = useState(false);
  const [filingNote, setFilingNote] = useState<{ ok: boolean; text: string; link?: string } | null>(null);
  // The insurance line whose default companies have already been seeded into the
  // selection. Loading a comparison for editing sets it too, so the seeding
  // effect below leaves that record's own selection alone.
  const seededLineRef = useRef<string | null>(null);

  // Auto-load comparison when editComparison prop changes
  useEffect(() => {
    if (editComparison) {
      loadComparisonForEdit(editComparison);
    }
  }, [editComparison]);

  // Available companies: the line's own list plus anything added with
  // "+ Add Company", deduped so a custom name matching a default cannot appear
  // twice in the picker.
  useEffect(() => {
    if (!insuranceLine) {
      setAvailableCompanies([]);
      return;
    }

    const defaultCompanies = getInsuranceCompanies(insuranceLine);
    setAvailableCompanies([
      ...defaultCompanies,
      ...customCompanies.filter(company => !defaultCompanies.includes(company))
    ]);
  }, [insuranceLine, customCompanies]);

  // Seed the selection with the line's default companies — but only when the
  // line itself changes. This used to re-run whenever a custom company was
  // added, which reset the selection back to the defaults and dropped both the
  // company just added and, while editing, the companies the saved record held.
  useEffect(() => {
    if (!insuranceLine || seededLineRef.current === insuranceLine) return;

    seededLineRef.current = insuranceLine;
    setSelectedCompanies(getInsuranceCompanies(insuranceLine));
    // A different line brings its own scope/deductible defaults, so the previous
    // line's quotes are discarded rather than carried into the reconcile below.
    setQuotes([]);
  }, [insuranceLine]);

  // Keep exactly one quote per selected company, in selection order.
  // Reconciled rather than rebuilt, so ticking a fourth insurer onto a saved
  // three-insurer comparison adds that column while the figures already entered
  // for the other three stay put. Quotes were previously never rebuilt while
  // editing, so an insurer added to a saved comparison had no quote behind it —
  // it showed no card to fill in and never reached the generated document.
  useEffect(() => {
    if (!insuranceLine) return;

    setQuotes(prev => {
      // Held per company as a queue rather than a single entry, so a record that
      // somehow carries the same insurer twice keeps two independent quotes
      // instead of two references to one.
      const existing = new Map<string, Quote[]>();
      prev.forEach(quote => {
        const queued = existing.get(quote.company);
        if (queued) queued.push(quote);
        else existing.set(quote.company, [quote]);
      });

      const next = selectedCompanies.map(company => existing.get(company)?.shift() ?? createEmptyQuote(company));
      // Returning the same array when nothing moved keeps this from re-rendering
      // on every unrelated state change.
      const unchanged = next.length === prev.length && next.every((quote, i) => quote === prev[i]);
      return unchanged ? prev : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompanies, insuranceLine]);

  // Add new custom company
  const addCustomCompany = () => {
    const companyName = newCompanyName.trim();
    if (!companyName || availableCompanies.includes(companyName)) return;

    setCustomCompanies(prev => [...prev, companyName]);
    // Selected as well as added — an advisor who types a company in wants its
    // column, and the reconcile effect creates the quote to go with it.
    setSelectedCompanies(prev => (prev.includes(companyName) ? prev : [...prev, companyName]));
    setNewCompanyName('');
    setShowAddCompany(false);
  };

  // Remove custom company
  const removeCustomCompany = (companyName: string) => {
    setCustomCompanies(prev => prev.filter(c => c !== companyName));
    setSelectedCompanies(prev => prev.filter(c => c !== companyName));
  };

  // FIXED: Load saved comparison for editing - properly preserve all pricing values
  const loadComparisonForEdit = (comparison: SavedComparison) => {
    setIsEditing(true);
    setEditingComparison(comparison);
    
    // Load all the data back into the form
    const insuranceLineValue = INSURANCE_LINES.find(line => line.label === comparison.insuranceLine)?.value || '';
    // Claim the line before setting it, so the seeding effect does not overwrite
    // this record's companies with the line's defaults.
    seededLineRef.current = insuranceLineValue;
    setInsuranceLine(insuranceLineValue);
    setCustomerName(comparison.customerName || '');
    setAddress(comparison.address || '');
    setBusinessActivity(comparison.businessActivity || '');
    setLocation(comparison.location || '');
    // A PAR / SME record from before Sum Insured replaced "Property Insured -
    // Limit" carries its limit over, so saving it again doesn't drop it.
    setTotalSumInsured(comparison.totalSumInsured || comparison.propertyLimit || '');
    setNumberOfEmployees(comparison.numberOfEmployees || '');
    setPolicyFrom(comparison.policyFrom || '');
    setPolicyTo(comparison.policyTo || '');
    setRemarks(comparison.remarks || '');
    setEnquiryNumber(comparison.enquiryNumber || '');
    setEnquiry(comparison.enquiry || null);
    setFilingNote(null);
    setAdvisorComment(comparison.advisorComment || '');

    // Load quotes and companies - preserve all values including premium
    const companyNames = comparison.quotes.map(q => q.company);
    setSelectedCompanies(companyNames);
    
    // CRITICAL FIX: Properly convert all numeric values and preserve them
    const loadedQuotes = comparison.quotes.map(quote => {
      const premium = parseFloat(quote.premium?.toString() || '0') || 0;
      const policyFee = parseFloat(quote.policyFee?.toString() || '0') || 0;
      const vat = parseFloat(quote.vat?.toString() || '0') || 0;
      const total = parseFloat(quote.total?.toString() || '0') || 0;
      
      return {
        ...quote,
        // Ensure all numeric values are properly loaded and converted
        premium: premium,
        policyFee: policyFee,
        vat: vat,
        total: total,
        // Preserve arrays properly
        conditions: Array.isArray(quote.conditions) ? [...quote.conditions] : [],
        exclusions: Array.isArray(quote.exclusions) ? [...quote.exclusions] : [],
        // Rebuild the inner objects rather than shallow-copying the array, so
        // editing a benefit can't mutate the saved history record in place.
        benefits: Array.isArray(quote.benefits)
          ? quote.benefits.map(b => ({ label: b.label, value: b.value }))
          : undefined
      };
    });
    
    // Set quotes immediately after loading
    setQuotes(loadedQuotes);
    
    // Add any custom companies that aren't in defaults
    const defaultCompanies = getInsuranceCompanies(insuranceLineValue);
    const customCompaniesList = companyNames.filter(name => !defaultCompanies.includes(name));
    setCustomCompanies(prev => {
      const newCustom = [...prev];
      customCompaniesList.forEach(company => {
        if (!newCustom.includes(company)) {
          newCustom.push(company);
        }
      });
      return newCustom;
    });
    
    console.log('Loaded quotes for editing:', loadedQuotes); // Debug log
  };

  // Cancel editing and reset
  const cancelEdit = () => {
    setIsEditing(false);
    setEditingComparison(null);
    resetForm();
    if (onCancelEdit) {
      onCancelEdit();
    }
  };

  const createEmptyQuote = (company: string): Quote => {
    const defaults = getLineDefaults(insuranceLine);
    const { vat, total } = calculateVAT(0, 0, insuranceLine);
    
    return {
      id: generateId(),
      company,
      scopeOfCover: defaults.scopeOfCover || '',
      geographicalLimits: defaults.geographicalLimits || 'United Arab Emirates',
      conditions: [...defaults.conditions],
      exclusions: [...defaults.exclusions],
      deductible: defaults.deductible || '',
      premiumRate: '',
      ...(isRatedOnSumInsured(insuranceLine) && { rateBasis: 100 as const }),
      premium: 0,
      policyFee: 0,
      vat: vat,
      total: total,
      isRecommended: false,
      // Each company gets its own column's figures, so Elite/Premier/Standard
      // open pre-filled with different values. Undefined for every other line.
      benefits: isTravelLine(insuranceLine) ? getTravelBenefits(company) : undefined
    };
  };

  const handleCompanyToggle = (company: string) => {
    if (selectedCompanies.includes(company)) {
      setSelectedCompanies(selectedCompanies.filter(c => c !== company));
    } else {
      setSelectedCompanies([...selectedCompanies, company]);
    }
  };

  const updateQuote = (index: number, field: keyof Quote, value: any) => {
    const newQuotes = [...quotes];
    newQuotes[index] = { ...newQuotes[index], [field]: value };
    
    // GLPA / WC EL / PI: the premium follows Sum Insured x Premium Rate.
    if ((field === 'premiumRate' || field === 'rateBasis') && isRatedOnSumInsured(insuranceLine)) {
      const { premiumRate, rateBasis } = newQuotes[index];
      const premium = premiumFromRate(totalSumInsured, premiumRate, rateBasis);
      if (premium !== null) newQuotes[index].premium = premium;
    }

    // Recalculate VAT and total if premium, rate or policy fee changes
    if (field === 'premium' || field === 'policyFee' || field === 'premiumRate' || field === 'rateBasis') {
      const { vat, total } = calculateVAT(newQuotes[index].premium, newQuotes[index].policyFee, insuranceLine);
      newQuotes[index].vat = vat;
      newQuotes[index].total = total;
    }
    
    setQuotes(newQuotes);
  };

  // Most policies run a year, so picking a start date fills the end date with
  // start + 1 year − 1 day — unless an end date was already chosen by hand.
  const updatePolicyFrom = (value: string) => {
    if (!policyTo || policyTo === oneYearPolicyEnd(policyFrom)) setPolicyTo(oneYearPolicyEnd(value));
    setPolicyFrom(value);
  };

  // A new Sum Insured reprices every quote that already has a rate — on the
  // rated lines only. Elsewhere the premium is typed in and must not move.
  const updateTotalSumInsured = (value: string) => {
    setTotalSumInsured(value);
    if (!isRatedOnSumInsured(insuranceLine)) return;
    setQuotes(quotes.map(quote => {
      const premium = premiumFromRate(value, quote.premiumRate, quote.rateBasis);
      if (premium === null) return quote;
      const { vat, total } = calculateVAT(premium, quote.policyFee, insuranceLine);
      return { ...quote, premium, vat, total };
    }));
  };

  // The comparison as the form holds it, or null (with the reason shown) when
  // it isn't complete enough to save. `linked` is passed when an enquiry has
  // just been picked, which saves before React has applied the new state.
  const buildComparisonData = (linked: ZohoEnquiry | null = enquiry): SavedComparison | null => {
    if (!insuranceLine) {
      alert('Please select an insurance line');
      return null;
    }

    if (!customerName.trim()) {
      alert('Please enter customer name');
      return null;
    }

    if (quotes.length === 0) {
      alert('Please add at least one quote');
      return null;
    }

    return {
      id: editingComparison ? editingComparison.id : generateId(),
      date: editingComparison ? editingComparison.date : new Date().toISOString(),
      insuranceLine: INSURANCE_LINES.find(il => il.value === insuranceLine)?.label || insuranceLine,
      customerName,
      address,
      businessActivity,
      location,
      totalSumInsured,
      ...(isEmployeeLine(insuranceLine) && { numberOfEmployees }),
      policyFrom,
      policyTo,
      remarks,
      enquiryNumber: linked ? linked.enquiryNo : enquiryNumber,
      enquiry: linked,
      // Filter out empty lines from conditions and exclusions when saving
      quotes: quotes.map(quote => ({
        ...quote,
        conditions: quote.conditions.filter(c => c.trim().length > 0),
        exclusions: quote.exclusions.filter(e => e.trim().length > 0)
      })),
      advisorComment,
      referenceNumber: editingComparison ? editingComparison.referenceNumber : generateReferenceNumber()
    };
  };

  // Saves to shared Blob storage so every advisor sees the same history.
  const persistComparison = async (comparisonData: SavedComparison) => {
    try {
      const response = editingComparison
        ? await fetch(`/api/comparisons/${editingComparison.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(comparisonData)
          })
        : await fetch('/api/comparisons', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(comparisonData)
          });

      if (!response.ok) {
        throw new Error(`Server responded ${response.status}`);
      }
      return true;
    } catch (saveError) {
      console.error('❌ Save failed:', saveError);
      alert('❌ Failed to save comparison. Please check your connection and try again.');
      return false;
    }
  };

  const saveComparison = async () => {
    const comparisonData = buildComparisonData();
    if (!comparisonData) return;

    const action = isEditing ? 'updated' : 'saved';
    let workdrive: WorkDriveResult | null = null;

    setSaving(true);
    try {
      if (!(await persistComparison(comparisonData))) return;
      // Downloads the PDF, and files the same PDF in WorkDrive when an enquiry
      // is linked.
      workdrive = await downloadComparison(comparisonData);
    } finally {
      setSaving(false);
    }

    // Reset form and edit state
    setIsEditing(false);
    setEditingComparison(null);
    resetForm();

    // Trigger completion page
    if (onSaveComplete) {
      onSaveComplete(comparisonData, workdrive);
    } else {
      alert(`✅ Comparison ${action} successfully!\nReference: ${comparisonData.referenceNumber}\n${workDriveNote(comparisonData.enquiry, workdrive)}`);
    }
  };

  // Saves the comparison and files its PDF in the enquiry's WorkDrive, with
  // nothing downloaded — for an advisor who edits a comparison but doesn't need
  // another local copy. The form stays open on the saved record, so saving
  // again updates it rather than adding a duplicate.
  const saveToWorkDrive = async (linked: ZohoEnquiry | null = enquiry) => {
    if (!linked) {
      setFilingNote({ ok: false, text: 'Link a Zoho enquiry first.' });
      return;
    }
    const comparisonData = buildComparisonData(linked);
    if (!comparisonData) return;

    setFiling(true);
    setFilingNote({ ok: true, text: `Saving to ${linked.enquiryNo}'s WorkDrive…` });
    try {
      if (!(await persistComparison(comparisonData))) {
        setFilingNote(null);
        return;
      }
      setIsEditing(true);
      setEditingComparison(comparisonData);

      const result = await saveComparisonToWorkDrive(comparisonData);
      setFilingNote(
        result?.ok
          ? { ok: true, text: `Comparison saved and filed in WorkDrive as ${result.fileName}.`, link: result.link }
          : { ok: false, text: `Comparison saved. ${workDriveNote(linked, result)}` }
      );
    } finally {
      setFiling(false);
    }
  };

  // Links (or unlinks) the Zoho enquiry. On a comparison that is already saved,
  // linking files its PDF in WorkDrive straight away: nobody re-downloads a
  // quote already sent, so older comparisons would otherwise never be filed.
  // A comparison still being built is filed when it is saved.
  const selectEnquiry = (picked: ZohoEnquiry | null) => {
    setEnquiry(picked);
    setEnquiryNumber(picked ? picked.enquiryNo : '');
    setFilingNote(null);
    if (picked && !customerName.trim()) setCustomerName(picked.contactName || picked.enquiryName);
    if (picked && editingComparison) void saveToWorkDrive(picked);
  };

  const resetForm = () => {
    // Cleared, or picking the same line again would find it already seeded and
    // start with no companies selected.
    seededLineRef.current = null;
    setInsuranceLine('');
    setCustomerName('');
    setAddress('');
    setBusinessActivity('');
    setLocation('');
    setTotalSumInsured('');
    setNumberOfEmployees('');
    setPolicyFrom('');
    setPolicyTo('');
    setRemarks('');
    setEnquiryNumber('');
    setEnquiry(null);
    setFilingNote(null);
    setAdvisorComment('');
    setQuotes([]);
    setAvailableCompanies([]);
    setSelectedCompanies([]);
    // Keep custom companies for future use unless explicitly cleared
    setNewCompanyName('');
    setShowAddCompany(false);
  };

  const downloadComparison = downloadComparisonDocument;

  return (
    <div className="grid grid-cols-1 gap-5">
      <div className="bg-white rounded-xl p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800">
            {isEditing ? '✏️ Edit Insurance Quote' : 'General Insurance Quote Generator'}
          </h2>
          {isEditing && (
            <button
              onClick={cancelEdit}
              className="bg-red-600 text-white px-4 py-2 rounded font-bold hover:bg-red-700 transition"
            >
              Cancel Edit
            </button>
          )}
        </div>

        {isEditing && editingComparison && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-300 rounded-lg">
            <p className="text-sm font-bold text-yellow-800">
              📝 Editing: {editingComparison.referenceNumber} | {editingComparison.customerName} | {editingComparison.insuranceLine}
            </p>
            <p className="text-xs text-yellow-600">Make your changes and click "Save Changes" to update this comparison.</p>
          </div>
        )}
        
        {/* Insurance Line Selection */}
        <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg">
          <label className="block text-sm font-bold mb-2 text-gray-800">Select Insurance Line *</label>
          <select
            className="w-full p-3 border-2 border-gray-300 rounded-lg text-gray-900 bg-white focus:border-indigo-500 focus:outline-none"
            value={insuranceLine}
            onChange={(e) => setInsuranceLine(e.target.value)}
          >
            <option value="">-- Select Insurance Line --</option>
            {INSURANCE_LINES.map(line => (
              <option key={line.value} value={line.value}>{line.label}</option>
            ))}
          </select>
        </div>

        {insuranceLine && (
          <>
            {/* Client & Policy Details — four columns on a wide screen, so the
                whole block fits in a few rows instead of a long half-width list */}
            <div className="mb-6 px-4 py-3 bg-gray-50 rounded-lg">
              <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
                <h3 className="text-base font-bold text-gray-800">Client &amp; Policy Details</h3>
                {/* Not editable: a new comparison is stamped when it is first
                    saved, and keeps that date through later edits. */}
                <span className="text-xs text-gray-600 bg-white border border-gray-200 rounded-full px-3 py-0.5">
                  📅 Date: <strong>{editingComparison ? formatQuoteDate(editingComparison.date) : new Date().toLocaleDateString('en-GB')}</strong>                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-2 mb-2">
                <div className="lg:col-span-2">
                  <label className={DETAIL_LABEL}>Client Name <span className="text-red-600">*</span></label>
                  <input
                    type="text"
                    className={DETAIL_INPUT}
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g., ABC Trading LLC"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className={DETAIL_LABEL}>Zoho Enquiry</label>
                  {/* Older comparisons hold a hand-typed number and no link; it
                      seeds the search so linking them is one click. */}
                  <EnquiryPicker
                    defaultQuery={(!enquiry && enquiryNumber) || customerName}
                    enquiry={enquiry}
                    onSelect={selectEnquiry}
                    disabled={saving || filing}
                  />
                  {editingComparison && !enquiry && (
                    <p className="text-[11px] text-gray-500 mt-1">
                      Picking an enquiry saves this comparison and files its PDF in that enquiry&rsquo;s WorkDrive.
                    </p>
                  )}
                </div>

                <div>
                  <label className={DETAIL_LABEL}>Business Activity</label>
                  <input
                    type="text"
                    className={DETAIL_INPUT}
                    value={businessActivity}
                    onChange={(e) => setBusinessActivity(e.target.value)}
                    placeholder="e.g., General trading"
                  />
                </div>

                <div>
                  <label className={DETAIL_LABEL}>Address</label>
                  <input
                    type="text"
                    className={DETAIL_INPUT}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Client's office address"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className={DETAIL_LABEL}>Location / Premises (Risk Address)</label>
                  <input
                    type="text"
                    className={DETAIL_INPUT}
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Where the insured risk is located"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-2">
                <div>
                  <label className={DETAIL_LABEL}>Policy Start Date</label>
                  <input
                    type="date"
                    className={DETAIL_INPUT}
                    value={policyFrom}
                    onChange={(e) => updatePolicyFrom(e.target.value)}
                  />
                </div>

                <div>
                  <label className={DETAIL_LABEL}>Policy End Date</label>
                  <input
                    type="date"
                    className={DETAIL_INPUT}
                    value={policyTo}
                    min={policyFrom || undefined}
                    onChange={(e) => setPolicyTo(e.target.value)}
                  />
                </div>

                <div>
                  <label className={DETAIL_LABEL}>Sum Insured</label>
                  <input
                    type="text"
                    className={DETAIL_INPUT}
                    value={totalSumInsured}
                    onChange={(e) => updateTotalSumInsured(e.target.value)}
                    placeholder="e.g., AED 1,000,000"
                  />
                </div>

                {isEmployeeLine(insuranceLine) && (
                  <div>
                    <label className={DETAIL_LABEL}>Total Number of Employees</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className={DETAIL_INPUT}
                      value={numberOfEmployees}
                      onChange={(e) => setNumberOfEmployees(e.target.value)}
                      placeholder="e.g., 25"
                    />
                  </div>
                )}
              </div>

              {/* One line of hints under the row rather than one per field. */}
              {((policyFrom || policyTo) || isRatedOnSumInsured(insuranceLine)) && (
                <p className="mt-1 text-[11px] text-gray-500">
                  {(policyFrom || policyTo) && <span className="text-gray-700">{policyPeriodHint(policyFrom, policyTo)}</span>}
                  {(policyFrom || policyTo) && isRatedOnSumInsured(insuranceLine) && ' · '}
                  {isRatedOnSumInsured(insuranceLine) && 'Premiums below are calculated from the Sum Insured and each insurer’s rate.'}
                </p>
              )}
            </div>

            {/* Company Selection */}
            {availableCompanies.length > 0 && (
              <div className="mb-6 p-4 bg-yellow-50 rounded-lg border-2 border-yellow-300">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-lg font-bold text-gray-800">Select Insurance Companies</h3>
                  <button
                    onClick={() => setShowAddCompany(!showAddCompany)}
                    className="bg-green-600 text-white px-3 py-1 rounded text-sm font-bold hover:bg-green-700 transition"
                  >
                    + Add Company
                  </button>
                </div>

                {/* Add Custom Company */}
                {showAddCompany && (
                  <div className="mb-4 p-3 bg-white rounded border border-green-300">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Enter company name"
                        value={newCompanyName}
                        onChange={(e) => setNewCompanyName(e.target.value)}
                        className="flex-1 p-2 border border-gray-300 rounded text-sm"
                        onKeyPress={(e) => e.key === 'Enter' && addCustomCompany()}
                      />
                      <button
                        onClick={addCustomCompany}
                        className="bg-green-600 text-white px-4 py-2 rounded text-sm font-bold hover:bg-green-700"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => { setShowAddCompany(false); setNewCompanyName(''); }}
                        className="bg-gray-500 text-white px-3 py-2 rounded text-sm hover:bg-gray-600"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {availableCompanies.map(company => {
                    const isDefault = getInsuranceCompanies(insuranceLine).includes(company);
                    const isCustom = customCompanies.includes(company);
                    
                    return (
                      <div key={company} className={`flex items-center gap-2 p-2 rounded ${isDefault ? 'bg-blue-50 border border-blue-200' : 'bg-green-50 border border-green-200'}`}>
                        <label className="flex items-center gap-2 cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={selectedCompanies.includes(company)}
                            onChange={() => handleCompanyToggle(company)}
                            className="w-4 h-4"
                          />
                          <span className="text-sm font-semibold text-gray-800">{company}</span>
                          {isDefault && <span className="text-xs bg-blue-500 text-white px-1 rounded">Default</span>}
                          {isCustom && <span className="text-xs bg-green-500 text-white px-1 rounded">Custom</span>}
                        </label>
                        {isCustom && (
                          <button
                            onClick={() => removeCustomCompany(company)}
                            className="text-red-600 hover:text-red-800 text-sm"
                            title="Remove custom company"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  ✓ {selectedCompanies.length} of {availableCompanies.length} companies selected • 
                  {customCompanies.length > 0 && ` ${customCompanies.length} custom companies added • `}
                  Select/deselect to customize comparison
                </p>
              </div>
            )}

            {/* Quotes */}
            {quotes.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-bold mb-3 text-gray-800">Quote Comparison ({quotes.length} Companies)</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {quotes.map((quote, idx) => (
                    <div key={quote.id} className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-lg border-2 border-gray-300 hover:border-indigo-400 transition">
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="text-lg font-bold text-indigo-700">{quote.company}</h4>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={quote.isRecommended}
                            onChange={(e) => updateQuote(idx, 'isRecommended', e.target.checked)}
                          />
                          <span className="text-xs font-bold">⭐ Recommend</span>
                        </label>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-bold mb-1 text-gray-800">Scope of Cover</label>
                          <textarea
                            className="w-full p-2 border-2 border-gray-300 rounded text-xs text-gray-900 bg-white focus:border-indigo-500 focus:outline-none"
                            value={quote.scopeOfCover}
                            onChange={(e) => updateQuote(idx, 'scopeOfCover', e.target.value)}
                            rows={3}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold mb-1 text-gray-800">Geographical Limits</label>
                          <input
                            type="text"
                            className="w-full p-2 border-2 border-gray-300 rounded text-xs text-gray-900 bg-white focus:border-indigo-500 focus:outline-none"
                            value={quote.geographicalLimits}
                            onChange={(e) => updateQuote(idx, 'geographicalLimits', e.target.value)}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold mb-1 text-gray-800">Conditions/Extensions</label>
                          <div className="bg-white p-2 rounded border">
                            <textarea
                              className="w-full p-2 border border-gray-300 rounded text-xs text-gray-800 min-h-[120px] resize-vertical"
                              value={quote.conditions.join('\n')}
                              onChange={(e) => {
                                // REAL FIX: Don't filter empty lines - let user press Enter freely
                                const lines = e.target.value.split('\n');
                                updateQuote(idx, 'conditions', lines);
                              }}
                              placeholder="Type each condition on a new line:
First condition here
Second condition here
Press Enter for new line"
                              style={{ fontFamily: 'monospace', lineHeight: '1.4', whiteSpace: 'pre-wrap' }}
                            />
                            <p className="text-xs text-gray-500 mt-1">✓ {quote.conditions.length} conditions • Press Enter for new line</p>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold mb-1 text-gray-800">Main Exclusions</label>
                          <div className="bg-red-50 p-2 rounded border border-red-200">
                            <textarea
                              className="w-full p-2 border border-gray-300 rounded text-xs text-gray-700 bg-white min-h-[100px] resize-vertical"
                              value={quote.exclusions.join('\n')}
                              onChange={(e) => {
                                // REAL FIX: Don't filter empty lines - let user press Enter freely
                                const lines = e.target.value.split('\n');
                                updateQuote(idx, 'exclusions', lines);
                              }}
                              placeholder="Type each exclusion on a new line:
First exclusion here
Second exclusion here
Press Enter for new line"
                              style={{ fontFamily: 'monospace', lineHeight: '1.4', whiteSpace: 'pre-wrap' }}
                            />
                            <p className="text-xs text-gray-500 mt-1">{quote.exclusions.length} exclusions • Press Enter for new line</p>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold mb-1 text-gray-800">Deductible</label>
                          <input
                            type="text"
                            className="w-full p-2 border-2 border-gray-300 rounded text-xs text-gray-900 bg-white focus:border-indigo-500 focus:outline-none"
                            value={quote.deductible}
                            onChange={(e) => updateQuote(idx, 'deductible', e.target.value)}
                            placeholder="e.g., AED 2,500 each and every loss"
                          />
                        </div>

                        {isTravelLine(insuranceLine) && quote.benefits && (
                          <div>
                            <label className="block text-xs font-bold mb-1 text-gray-800">Schedule of Benefits (USD)</label>
                            <div className="bg-white p-2 rounded border max-h-[400px] overflow-y-auto">
                              {quote.benefits.map((benefit, bIdx) => {
                                const isHeader = TRAVEL_BENEFITS[bIdx]?.isHeader;

                                if (isHeader) {
                                  return (
                                    <div key={benefit.label} className="bg-gray-200 text-gray-800 text-xs font-bold px-2 py-1 rounded mt-2 mb-1">
                                      {benefit.label}
                                    </div>
                                  );
                                }

                                return (
                                  <div key={benefit.label} className="mb-1">
                                    <label className="block text-[10px] text-gray-600 leading-tight">{benefit.label}</label>
                                    <input
                                      type="text"
                                      className="w-full p-1 border border-gray-300 rounded text-xs text-gray-900 bg-white focus:border-indigo-500 focus:outline-none"
                                      value={benefit.value}
                                      onChange={(e) => {
                                        // Replace one entry immutably; routing through updateQuote
                                        // means the premium/VAT maths is never touched.
                                        const updated = quote.benefits!.map((b, i) =>
                                          i === bIdx ? { ...b, value: e.target.value } : b
                                        );
                                        updateQuote(idx, 'benefits', updated);
                                      }}
                                      placeholder="e.g., 7500 or Not Covered"
                                    />
                                  </div>
                                );
                              })}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              ✓ {quote.benefits.filter((_, i) => !TRAVEL_BENEFITS[i]?.isHeader).length} benefits
                            </p>
                          </div>
                        )}

                        <div>
                          <label className="block text-xs font-bold mb-1 text-gray-800">Premium Rate</label>
                          <input
                            type="text"
                            className="w-full p-2 border-2 border-gray-300 rounded text-xs text-gray-900 bg-white focus:border-indigo-500 focus:outline-none"
                            value={quote.premiumRate}
                            onChange={(e) => updateQuote(idx, 'premiumRate', e.target.value)}
                            placeholder={isRatedOnSumInsured(insuranceLine) ? 'e.g., 5 (premium is calculated)' : 'e.g., 0.5% of sum insured'}
                          />
                          {isRatedOnSumInsured(insuranceLine) && (
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-[11px] text-gray-700">
                              {([100, 1000] as const).map(basis => (
                                <label key={basis} className="flex items-center gap-1 cursor-pointer">
                                  <input
                                    type="radio"
                                    name={`rate-basis-${quote.id}`}
                                    checked={(quote.rateBasis ?? 100) === basis}
                                    onChange={() => updateQuote(idx, 'rateBasis', basis)}
                                  />
                                  <span className="font-semibold">{basis === 100 ? '% (÷ 100)' : '‰ (÷ 1000)'}</span>
                                </label>
                              ))}
                              <span className="text-gray-500">
                                Premium = Sum Insured × Rate ÷ {quote.rateBasis ?? 100}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-bold mb-1 text-gray-800">Premium (AED)</label>
                            <input
                              type="number"
                              className="w-full p-2 border-2 border-gray-300 rounded text-xs text-gray-900 bg-white focus:border-indigo-500 focus:outline-none"
                              value={quote.premium}
                              onChange={(e) => updateQuote(idx, 'premium', parseFloat(e.target.value) || 0)}
                              step="0.01"
                              min="0"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold mb-1 text-gray-800">Policy Fee (AED)</label>
                            <input
                              type="number"
                              className="w-full p-2 border-2 border-gray-300 rounded text-xs text-gray-900 bg-white focus:border-indigo-500 focus:outline-none"
                              value={quote.policyFee}
                              onChange={(e) => updateQuote(idx, 'policyFee', parseFloat(e.target.value) || 0)}
                              step="0.01"
                              min="0"
                            />
                          </div>
                        </div>

                        <div className="bg-indigo-50 p-2 rounded">
                          {insuranceLine === 'marine-cargo' ? (
                            <div className="flex justify-between text-sm">
                              <span className="font-bold text-indigo-700">Total:</span>
                              <span className="font-bold text-indigo-700">AED {quote.total.toFixed(2)}</span>
                            </div>
                          ) : insuranceLine === 'glpa' ? (
                            <>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="font-bold text-gray-700">VAT:</span>
                                <span className="font-bold text-gray-900">Not Applicable</span>
                              </div>
                              <div className="flex justify-between text-sm border-t border-indigo-200 pt-1">
                                <span className="font-bold text-indigo-700">Total:</span>
                                <span className="font-bold text-indigo-700">AED {quote.total.toFixed(2)}</span>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="font-bold text-gray-700">VAT (5%):</span>
                                <span className="font-bold text-gray-900">AED {quote.vat.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between text-sm border-t border-indigo-200 pt-1">
                                <span className="font-bold text-indigo-700">Total:</span>
                                <span className="font-bold text-indigo-700">AED {quote.total.toFixed(2)}</span>
                              </div>
                            </>
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-bold mb-1 text-gray-800">Quote Validity</label>
                          <input
                            type="date"
                            className="w-full p-2 border-2 border-gray-300 rounded text-xs text-gray-900 bg-white focus:border-indigo-500 focus:outline-none"
                            value={quote.quoteValidity || ''}
                            onChange={(e) => updateQuote(idx, 'quoteValidity', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Remarks + Advisor Comment — both optional, printed under the table */}
            <div className="mb-6 p-4 bg-yellow-50 rounded-lg border-2 border-yellow-300">
              <label className="block text-sm font-bold mb-2 text-gray-800">Remarks <span className="font-normal text-gray-500">(optional)</span></label>
              <textarea
                className="w-full p-3 mb-4 border-2 border-gray-300 rounded text-gray-900 bg-white focus:border-yellow-500 focus:outline-none"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={2}
                placeholder="Any remarks to print on the comparison — left off the document when empty"
              />
              <label className="block text-sm font-bold mb-2 text-gray-800">Advisor Comment <span className="font-normal text-gray-500">(optional)</span></label>
              <textarea
                className="w-full p-3 border-2 border-gray-300 rounded text-gray-900 bg-white focus:border-yellow-500 focus:outline-none"
                value={advisorComment}
                onChange={(e) => setAdvisorComment(e.target.value)}
                rows={4}
                placeholder="Add any special notes, recommendations, or important information for the client..."
              />
            </div>

            {filingNote && (
              <div className={`mb-4 p-3 rounded-lg border-2 text-sm font-semibold ${filingNote.ok ? 'bg-green-50 border-green-300 text-green-800' : 'bg-amber-50 border-amber-300 text-amber-900'}`}>
                {filingNote.ok ? '📁 ' : '⚠️ '}{filingNote.text}
                {filingNote.link && (
                  <a href={filingNote.link} target="_blank" rel="noreferrer" className="ml-2 underline">
                    Open in WorkDrive
                  </a>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                onClick={saveComparison}
                disabled={saving || filing}
                className="flex-1 bg-green-600 text-white p-4 rounded-lg font-bold text-lg hover:bg-green-700 transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving
                  ? '⏳ Saving...'
                  : isEditing ? '💾 Save Changes & Download' : '💾 Save & Download Comparison'}
              </button>
              <button
                onClick={() => { void saveToWorkDrive(); }}
                disabled={!enquiry || saving || filing}
                title={
                  enquiry
                    ? `Save this comparison and file its PDF in ${enquiry.enquiryNo}'s WorkDrive — no download`
                    : 'Link a Zoho enquiry first'
                }
                className="bg-indigo-600 text-white px-6 p-4 rounded-lg font-bold hover:bg-indigo-700 transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {filing ? '⏳ Saving to WorkDrive...' : '📁 Save to WorkDrive'}
              </button>
              <button
                onClick={resetForm}
                disabled={saving || filing}
                className="bg-gray-500 text-white px-6 p-4 rounded-lg font-bold hover:bg-gray-600 transition disabled:opacity-50"
              >
                🔄 Reset
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ============ SAVED HISTORY PAGE ============
function SavedHistoryPage({ onEditComparison }: { onEditComparison?: (comparison: SavedComparison) => void }) {
  const [history, setHistory] = useState<SavedComparison[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [localCount, setLocalCount] = useState(0);
  const [importing, setImporting] = useState(false);
  const [dateFilter, setDateFilter] = useState<'all' | 'thisMonth' | 'lastMonth' | 'custom'>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [lineFilter, setLineFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [fileImporting, setFileImporting] = useState(false);
  const [exportableCount, setExportableCount] = useState(0);
  const [exporting, setExporting] = useState<'comparisons' | 'plans' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadHistory();
    setLocalCount(readLocalHistory().length);
    setExportableCount(readAllLocalRecords().length);
  }, []);

  // Comparisons saved before the move to shared storage still live in this
  // browser only. They stay there until the advisor imports them.
  const readLocalHistory = (): SavedComparison[] => {
    try {
      const local = JSON.parse(localStorage.getItem('generalInsuranceHistory') || '[]');
      return Array.isArray(local) ? local : [];
    } catch {
      return [];
    }
  };

  // Everything this browser still holds, including records already imported once
  // (the import keeps a backup copy). Deduped by id, since a record that was
  // imported and then saved again would otherwise appear in both keys.
  const readAllLocalRecords = (): SavedComparison[] => {
    const byId = new Map<string, SavedComparison>();

    for (const key of ['generalInsuranceHistory', 'generalInsuranceHistoryBackup']) {
      try {
        const stored = JSON.parse(localStorage.getItem(key) || '[]');
        if (!Array.isArray(stored)) continue;
        for (const record of stored) {
          if (record?.id) byId.set(record.id, record);
        }
      } catch {
        // A corrupt key shouldn't hide the records in the other one.
      }
    }

    return Array.from(byId.values());
  };

  // Hands the advisor a file they can email in, for when talking someone through
  // DevTools isn't realistic. Exports what this browser holds, not the shared list.
  const exportLocalToFile = () => {
    const records = readAllLocalRecords();
    if (records.length === 0) {
      alert('This browser has no locally saved comparisons to export.');
      return;
    }

    const blob = new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nsib-comparisons-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Takes an exported file from another advisor's browser and pushes it into the
  // shared store. Records keep their original id and date, so a file imported
  // twice overwrites rather than duplicates, and month counts stay accurate.
  const importFromFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Clear immediately so picking the same file again still fires onChange.
    event.target.value = '';
    if (!file) return;

    let records: SavedComparison[];
    try {
      const parsed = JSON.parse(await file.text());
      if (!Array.isArray(parsed)) throw new Error('not an array');
      records = parsed.filter((r) => r?.id && r?.customerName);
    } catch {
      alert('That file could not be read. Expected a JSON file produced by the Backup button.');
      return;
    }

    if (records.length === 0) {
      alert('No valid comparisons found in that file.');
      return;
    }

    const existingIds = new Set(history.map(c => c.id));
    let added = 0;
    let updated = 0;
    let failed = 0;

    setFileImporting(true);

    for (const comparison of records) {
      try {
        const response = await fetch('/api/comparisons', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(comparison)
        });
        if (response.ok) {
          if (existingIds.has(comparison.id)) updated++;
          else added++;
        } else {
          failed++;
        }
      } catch (error) {
        console.error('Failed to import comparison:', comparison?.referenceNumber, error);
        failed++;
      }
    }

    setFileImporting(false);
    alert(
      `Import finished.\n\n` +
      `${added} new comparison${added === 1 ? '' : 's'} added\n` +
      `${updated} already present (overwritten with the file's copy)\n` +
      `${failed} failed`
    );
    loadHistory();
  };

  const importLocalHistory = async () => {
    const local = readLocalHistory();
    if (local.length === 0) return;

    setImporting(true);
    let imported = 0;

    for (const comparison of local) {
      try {
        const response = await fetch('/api/comparisons', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(comparison)
        });
        if (response.ok) imported++;
      } catch (error) {
        console.error('Failed to import comparison:', comparison?.referenceNumber, error);
      }
    }

    // Keep a backup rather than deleting outright, in case an import went wrong.
    if (imported === local.length) {
      localStorage.setItem('generalInsuranceHistoryBackup', JSON.stringify(local));
      localStorage.removeItem('generalInsuranceHistory');
      setLocalCount(0);
    }

    setImporting(false);
    alert(`Imported ${imported} of ${local.length} comparisons from this browser.`);
    loadHistory();
  };

  const loadHistory = async () => {
    try {
      setLoading(true);
      setLoadError(null);

      // Shared storage — every advisor sees the same list. Already sorted newest first.
      const response = await fetch('/api/comparisons', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Server responded ${response.status}`);
      }

      setHistory(await response.json());
    } catch (error) {
      console.error('❌ Failed to load data:', error);
      setLoadError('Could not load saved comparisons. Check your connection and try Refresh.');
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const deleteComparison = async (id: string) => {
    if (!confirm('Are you sure you want to delete this comparison? This removes it for everyone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/comparisons/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error(`Server responded ${response.status}`);
      }
      setHistory(prev => prev.filter(comp => comp.id !== id));
    } catch (error) {
      console.error('❌ Failed to delete:', error);
      alert('❌ Failed to delete comparison. Please try again.');
    }
  };

  // A copy re-downloaded from history is for the advisor, not a new version of
  // what was sent, so it isn't filed; "📁 WorkDrive" files it on purpose.
  const downloadComparison = (comparison: SavedComparison) =>
    downloadComparisonDocument(comparison, { fileIt: false });

  // The comparison being filed in WorkDrive from its card, if any.
  const [filingId, setFilingId] = useState<string | null>(null);

  const fileComparison = async (comparison: SavedComparison) => {
    setFilingId(comparison.id);
    try {
      const result = await saveComparisonToWorkDrive(comparison);
      alert(result?.ok
        ? `📁 Filed in WorkDrive as ${result.fileName}.`
        : `⚠️ ${workDriveNote(comparison.enquiry, result)}`);
    } finally {
      setFilingId(null);
    }
  };

  // Month boundaries for the "this month" / "last month" counters.
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const counts = useMemo(() => {
    let thisMonth = 0;
    let lastMonth = 0;
    for (const c of history) {
      const d = new Date(c.date);
      if (isNaN(d.getTime())) continue;
      if (d >= thisMonthStart && d < nextMonthStart) thisMonth++;
      else if (d >= lastMonthStart && d < thisMonthStart) lastMonth++;
    }
    return { total: history.length, thisMonth, lastMonth };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history]);

  const insuranceLines = useMemo(
    () => Array.from(new Set(history.map(c => c.insuranceLine))).sort(),
    [history]
  );

  // Everything an advisor might recognise a comparison by. Insurer names are
  // included so "orient" finds every comparison Orient was quoted on.
  const searchableText = (c: SavedComparison) =>
    [
      c.customerName,
      c.referenceNumber,
      c.enquiryNumber,
      c.insuranceLine,
      c.businessActivity,
      c.location,
      c.address,
      ...c.quotes.map(q => q.company)
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

  // Each word must match, in any field and in any order, so "orient travel"
  // narrows rather than finding nothing.
  const searchTerms = search.trim().toLowerCase().split(/\s+/).filter(Boolean);

  const filteredHistory = useMemo(() => {
    return history.filter(c => {
      if (lineFilter !== 'all' && c.insuranceLine !== lineFilter) return false;

      if (searchTerms.length > 0) {
        const haystack = searchableText(c);
        if (!searchTerms.every(term => haystack.includes(term))) return false;
      }

      const d = new Date(c.date);
      if (isNaN(d.getTime())) return dateFilter === 'all';

      if (dateFilter === 'thisMonth') return d >= thisMonthStart && d < nextMonthStart;
      if (dateFilter === 'lastMonth') return d >= lastMonthStart && d < thisMonthStart;
      if (dateFilter === 'custom') {
        // Dates are inclusive on both ends; an empty box means "unbounded".
        // Compared as local yyyy-mm-dd, the same calendar the date boxes use.
        const day = localDay(d);
        if (customFrom && day < customFrom) return false;
        if (customTo && day > customTo) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, dateFilter, customFrom, customTo, lineFilter, search]);

  const filterLabel =
    dateFilter === 'thisMonth' ? 'this month'
    : dateFilter === 'lastMonth' ? 'last month'
    : dateFilter === 'custom' ? 'in the selected range'
    : 'in total';

  // Exports exactly what the filters are showing, as a styled Excel workbook.
  // The file name records the period so a saved report says what it covers.
  // layout: 'comparisons' (one row each) | 'plans' (one row per insurer's quote).
  const exportFiltered = async (layout: 'comparisons' | 'plans') => {
    const today = localDay(new Date());
    const scope =
      dateFilter === 'custom' ? `${customFrom || 'start'}_to_${customTo || today}`
      : dateFilter === 'thisMonth' ? 'this-month'
      : dateFilter === 'lastMonth' ? 'last-month'
      : 'all-time';
    const filters = {
      period:
        dateFilter === 'custom' ? `${customFrom || 'Beginning'} to ${customTo || 'today'}`
        : dateFilter === 'thisMonth' ? 'This month'
        : dateFilter === 'lastMonth' ? 'Last month'
        : 'All time',
      insuranceLine: lineFilter === 'all' ? 'All lines' : lineFilter,
      search: search.trim(),
    };

    setExporting(layout);
    try {
      const blob = layout === 'plans'
        ? await buildQuotesWorkbook(filteredHistory, filters)
        : await buildComparisonsWorkbook(filteredHistory, filters);
      // A cancelled "Save as" needs nothing further.
      await saveBlobAs(blob, `GI-${layout === 'plans' ? 'Plans' : 'Comparisons'}-${scope}-${today}.xlsx`);
    } catch (error) {
      console.error('❌ Export failed:', error);
      alert(`❌ Could not export: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-5">
      <div className="bg-white rounded-xl p-5 shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Saved History</h2>
            <p className="text-sm text-gray-600">☁️ Shared across all advisors</p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {exportableCount > 0 && (
              <button
                onClick={exportLocalToFile}
                className="bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded font-bold hover:bg-gray-100 transition"
                title="Save this browser's own comparisons to a file you can send in"
              >
                💾 Backup ({exportableCount})
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={importFromFile}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={fileImporting}
              className="bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded font-bold hover:bg-gray-100 transition disabled:opacity-50"
              title="Load an exported file from another advisor into the shared history"
            >
              {fileImporting ? '⏳ Importing...' : '📂 Import file'}
            </button>
            <button
              onClick={() => { void exportFiltered('comparisons'); }}
              disabled={loading || exporting !== null || filteredHistory.length === 0}
              className="bg-green-700 text-white px-4 py-2 rounded font-bold hover:bg-green-800 transition disabled:opacity-50"
              title="Download the comparisons matching the current filters — one row per comparison (Excel)"
            >
              {exporting === 'comparisons' ? '⏳ Exporting...' : `⬇ Export (${filteredHistory.length})`}
            </button>
            <button
              onClick={() => { void exportFiltered('plans'); }}
              disabled={loading || exporting !== null || filteredHistory.length === 0}
              className="bg-white text-green-700 border-2 border-green-700 px-4 py-2 rounded font-bold hover:bg-green-50 transition disabled:opacity-50"
              title="Download every insurer's quote in the filtered comparisons — one row per quote, for pivot tables (Excel)"
            >
              {exporting === 'plans' ? '⏳ Exporting...' : '⬇ Plans'}
            </button>
            <button
              onClick={loadHistory}
              disabled={loading}
              className="bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700 transition disabled:opacity-50"
            >
              {loading ? '🔄 Loading...' : '🔄 Refresh'}
            </button>
          </div>
        </div>
        
        {!loading && !loadError && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                <div className="text-xs font-semibold text-indigo-700 uppercase">Total saved</div>
                <div className="text-2xl font-bold text-indigo-900">{counts.total}</div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="text-xs font-semibold text-green-700 uppercase">This month</div>
                <div className="text-2xl font-bold text-green-900">{counts.thisMonth}</div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="text-xs font-semibold text-amber-700 uppercase">Last month</div>
                <div className="text-2xl font-bold text-amber-900">{counts.lastMonth}</div>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div className="text-xs font-semibold text-gray-600 uppercase">Showing</div>
                <div className="text-2xl font-bold text-gray-900">{filteredHistory.length}</div>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-3 mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="flex-1 min-w-[240px]">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Search</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">🔍</span>
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Customer, reference, enquiry no. or insurer"
                    className="w-full border border-gray-300 rounded pl-9 pr-8 py-2 text-sm bg-white text-gray-900 focus:border-indigo-500 focus:outline-none"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 text-sm"
                      title="Clear search"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Period</label>
                <select
                  value={dateFilter}
                  onChange={e => setDateFilter(e.target.value as typeof dateFilter)}
                  className="border border-gray-300 rounded px-3 py-2 text-sm bg-white"
                >
                  <option value="all">All time</option>
                  <option value="thisMonth">This month</option>
                  <option value="lastMonth">Last month</option>
                  <option value="custom">Date range (from – to)…</option>
                </select>
              </div>

              {dateFilter === 'custom' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">From</label>
                    <input
                      type="date"
                      value={customFrom}
                      max={customTo || undefined}
                      onChange={e => setCustomFrom(e.target.value)}
                      className="border border-gray-300 rounded px-3 py-2 text-sm bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">To</label>
                    <input
                      type="date"
                      value={customTo}
                      min={customFrom || undefined}
                      onChange={e => setCustomTo(e.target.value)}
                      className="border border-gray-300 rounded px-3 py-2 text-sm bg-white"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Insurance line</label>
                <select
                  value={lineFilter}
                  onChange={e => setLineFilter(e.target.value)}
                  className="border border-gray-300 rounded px-3 py-2 text-sm bg-white"
                >
                  <option value="all">All lines</option>
                  {insuranceLines.map(line => (
                    <option key={line} value={line}>{line}</option>
                  ))}
                </select>
              </div>

              {(dateFilter !== 'all' || lineFilter !== 'all' || search !== '') && (
                <button
                  onClick={() => { setDateFilter('all'); setLineFilter('all'); setCustomFrom(''); setCustomTo(''); setSearch(''); }}
                  className="px-3 py-2 rounded text-sm font-bold text-gray-700 bg-white border border-gray-300 hover:bg-gray-100 transition"
                >
                  ✖ Clear
                </button>
              )}

              <p className="text-sm text-gray-700 ml-auto">
                <strong>{filteredHistory.length}</strong> comparison{filteredHistory.length === 1 ? '' : 's'} {filterLabel}
                {lineFilter !== 'all' && ` for ${lineFilter}`}
                {searchTerms.length > 0 && ` matching "${search.trim()}"`}
              </p>
            </div>
          </>
        )}

        {localCount > 0 && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-300 rounded-lg flex justify-between items-center gap-4">
            <p className="text-sm text-blue-900">
              📦 <strong>{localCount}</strong> comparison{localCount === 1 ? '' : 's'} saved in this browser
              {' '}before shared storage was enabled. Import to make {localCount === 1 ? 'it' : 'them'} visible to everyone.
            </p>
            <button
              onClick={importLocalHistory}
              disabled={importing}
              className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-bold hover:bg-blue-700 transition disabled:opacity-50 whitespace-nowrap"
            >
              {importing ? '⏳ Importing...' : '⬆️ Import'}
            </button>
          </div>
        )}

        {loading ? (
          <div className="text-center text-gray-400 italic py-20">
            <div className="animate-spin text-4xl mb-4">⏳</div>
            Loading saved comparisons...
          </div>
        ) : loadError ? (
          <div className="text-center py-20">
            <div className="text-4xl mb-4">⚠️</div>
            <p className="text-red-700 font-semibold">{loadError}</p>
          </div>
        ) : history.length === 0 ? (
          <div className="text-center text-gray-400 italic py-20">
            No saved comparisons yet. Create a comparison and save it to see it here.
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="text-center text-gray-400 italic py-20">
            No comparisons match{searchTerms.length > 0 ? ' this search' : ' this filter'}. Try a different search, period or line.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredHistory.map(comparison => (
              <div key={comparison.id} className="bg-gradient-to-br from-gray-50 to-gray-100 p-5 rounded-lg border-2 border-gray-200 hover:border-indigo-400 transition shadow-sm hover:shadow-md">
                <div className="mb-3">
                  <div className="font-bold text-lg text-indigo-700">{comparison.insuranceLine}</div>
                  <div className="font-semibold text-gray-900">{comparison.customerName}</div>
                  <div className="text-xs text-gray-500">{formatDate(comparison.date)}</div>
                  <div className="text-xs text-indigo-600 font-mono">Ref: {comparison.referenceNumber}</div>
                  {comparison.enquiry ? (
                    <div className="text-xs text-green-700 font-semibold">🔗 Zoho {comparison.enquiry.enquiryNo}</div>
                  ) : comparison.enquiryNumber ? (
                    <div className="text-xs text-gray-500" title="Not linked to Zoho — edit to link it">
                      Enquiry {comparison.enquiryNumber} (not linked)
                    </div>
                  ) : null}
                </div>
                
                <div className="mb-3">
                  <div className="text-sm text-gray-700 mb-2"><strong>Quotes:</strong> {comparison.quotes.length}</div>
                  <div className="text-xs text-gray-600">
                    {comparison.quotes.map(q => (
                      <div key={q.id} className="truncate">
                        • {q.company} - AED {q.total.toLocaleString()}
                        {q.isRecommended && ' ⭐'}
                      </div>
                    ))}
                  </div>
                </div>

                {comparison.advisorComment && (
                  <div className="mb-3 p-2 bg-yellow-50 rounded text-xs text-gray-700 border-l-2 border-yellow-400">
                    <strong>Comment:</strong> {comparison.advisorComment.substring(0, 100)}{comparison.advisorComment.length > 100 ? '...' : ''}
                  </div>
                )}
                
                <div className="flex gap-2">
                  <button 
                    onClick={() => onEditComparison && onEditComparison(comparison)} 
                    className="bg-orange-600 text-white px-3 py-2 rounded text-sm font-bold hover:bg-orange-700 transition"
                    title="Edit this comparison"
                  >
                    ✏️ Edit
                  </button>
                  <button 
                    onClick={() => { void downloadComparison(comparison); }}
                    className="bg-purple-600 text-white px-3 py-2 rounded text-sm font-bold hover:bg-purple-700 transition"
                  >
                    📥 Download
                  </button>
                  {comparison.enquiry && (
                    <button
                      onClick={() => { void fileComparison(comparison); }}
                      disabled={filingId !== null}
                      className="bg-indigo-600 text-white px-3 py-2 rounded text-sm font-bold hover:bg-indigo-700 transition disabled:opacity-50"
                      title={`File this comparison's PDF in ${comparison.enquiry.enquiryNo}'s WorkDrive`}
                    >
                      {filingId === comparison.id ? '⏳' : '📁 WorkDrive'}
                    </button>
                  )}
                  <button
                    onClick={() => deleteComparison(comparison.id)} 
                    className="bg-red-600 text-white px-3 py-2 rounded text-sm font-bold hover:bg-red-700 transition"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============ MAIN APP ============
export default function App() {
  const [currentPage, setCurrentPage] = useState<'generator' | 'history' | 'completion'>('generator');
  const [completedComparison, setCompletedComparison] = useState<SavedComparison | null>(null);
  // What filing in WorkDrive came to, for a comparison linked to a Zoho enquiry.
  const [completedWorkDrive, setCompletedWorkDrive] = useState<WorkDriveResult | null>(null);
  const [comparisonToEdit, setComparisonToEdit] = useState<SavedComparison | null>(null);

  // Handle editing a comparison from history
  const handleEditComparison = (comparison: SavedComparison) => {
    setComparisonToEdit(comparison);
    setCurrentPage('generator');
  };

  // Completion Page Component (shows your image after saving quotes)
  const CompletionPage = () => (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-100 flex items-center justify-center p-5">
      <div className="max-w-4xl mx-auto text-center">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Success Message */}
          <div className="mb-8">
            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-white text-3xl">✓</span>
            </div>
            <h1 className="text-4xl font-bold text-gray-800 mb-4">
              Quote Comparison Complete!
            </h1>
            <p className="text-lg text-gray-600 mb-6">
              Your insurance comparison has been generated and saved successfully.
            </p>
            {completedComparison && (
              <div className="bg-blue-50 p-4 rounded-lg mb-6">
                <p className="font-bold text-blue-800">Reference: {completedComparison.referenceNumber}</p>
                <p className="text-blue-600">{completedComparison.quotes.length} companies compared</p>
                <p className="text-blue-600">Generated: {new Date().toLocaleDateString('en-GB')}</p>
              </div>
            )}
            {completedComparison?.enquiry && (
              <div className={`p-4 rounded-lg mb-6 border-2 ${completedWorkDrive?.ok ? 'bg-green-50 border-green-300 text-green-800' : 'bg-amber-50 border-amber-300 text-amber-900'}`}>
                <p className="font-bold">
                  {completedWorkDrive?.ok ? '📁 ' : '⚠️ '}
                  {workDriveNote(completedComparison.enquiry, completedWorkDrive)}
                </p>
                {completedWorkDrive?.ok && (
                  <a href={completedWorkDrive.link} target="_blank" rel="noreferrer" className="text-sm underline">
                    Open {completedWorkDrive.fileName} in WorkDrive
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Your Image */}
          <img 
            src="https://i.imgur.com/Qgh7Try.jpeg" 
            alt="NSIB General Insurance System" 
            className="w-full max-w-3xl mx-auto rounded-lg shadow-lg mb-8"
            style={{ maxHeight: '60vh', objectFit: 'contain' }}
          />
          
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-800">
              NSIB General Insurance System
            </h2>
            
            <p className="text-gray-600">
              Professional insurance quote comparison completed successfully
            </p>
            
            <div className="flex gap-4 justify-center mt-8">
              <button 
                onClick={() => {
                  setCurrentPage('generator');
                  setCompletedComparison(null);
                }}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transform hover:scale-105 transition-all duration-200 shadow-lg"
              >
                🔄 New Quote
              </button>
              
              <button 
                onClick={() => setCurrentPage('history')}
                className="bg-gradient-to-r from-gray-600 to-gray-700 text-white px-8 py-3 rounded-xl font-bold hover:from-gray-700 hover:to-gray-800 transform hover:scale-105 transition-all duration-200 shadow-lg"
              >
                📁 View History
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Show completion page with your image after saving quotes
  if (currentPage === 'completion') {
    return <CompletionPage />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-5">
      <div className="max-w-[1800px] mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">NSIB General Insurance Quote System</h1>
          
          <div className="flex justify-center gap-4">
            <button 
              onClick={() => setCurrentPage('generator')} 
              className={`px-8 py-3 rounded-lg font-bold transition ${currentPage === 'generator' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
            >
              📝 Quote Generator
            </button>
            <button 
              onClick={() => setCurrentPage('history')} 
              className={`px-8 py-3 rounded-lg font-bold transition ${currentPage === 'history' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
            >
              📁 Saved History
            </button>
          </div>
        </div>

        {currentPage === 'generator' ? (
          <QuoteGeneratorPage 
            onSaveComplete={(comparison, workdrive) => {
              setCompletedComparison(comparison);
              setCompletedWorkDrive(workdrive ?? null);
              setCurrentPage('completion');
              setComparisonToEdit(null); // Clear edit state after saving
            }}
            editComparison={comparisonToEdit}
            onCancelEdit={() => setComparisonToEdit(null)}
          />
        ) : (
          <SavedHistoryPage 
            onEditComparison={handleEditComparison}
          />
        )}
      </div>
    </div>
  );
}
