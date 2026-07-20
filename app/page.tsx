// app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import type { Quote, SavedComparison } from './lib/types';

// ============ CONSTANTS ============
const INSURANCE_LINES = [
  { value: 'sme', label: 'SME PACKAGE (PAR + TPL + WC EL)' },
  { value: 'par', label: 'PAR - Property All Risk Insurance' },
  { value: 'tpl', label: 'TPL - Third Party Liability Insurance' },
  { value: 'wcel', label: 'WC EL - Workmen\'s Compensation and Employer\'s Liability' },
  { value: 'car', label: 'CAR - Contractor\'s All Risk' },
  { value: 'cpm', label: 'CPM - Contractor\'s Plant and Machinery Insurance' },
  { value: 'glpa', label: 'GLPA - Group Life and Personal Accident Insurance' },
  { value: 'travel', label: 'TRAVEL - Travel Insurance' }
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
  }
};

// ============ UTILITY FUNCTIONS ============
const calculateVAT = (premium: number, policyFee: number = 0, insuranceLine?: string) => {
  const subtotal = premium + policyFee;
  // No VAT for GLPA insurance
  const vatRate = insuranceLine === 'glpa' ? 0 : 0.05;
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

// Builds the <tbody> of the printed comparison table. Rows are assembled first
// and numbered afterwards, so inserting the travel benefits (or skipping the VAT
// row for GLPA) can never desync the S.No column.
const buildComparisonRows = (comparison: SavedComparison, isGLPA: boolean, isTravel: boolean) => {
  const columnCount = comparison.quotes.length;

  type Row = {
    label: string;
    values: string[];
    isHeader?: boolean;
    isTotal?: boolean;
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
    { label: 'Premium Rate', values: comparison.quotes.map(q => text(q.premiumRate)) },
    { label: 'Premium (AED)', values: comparison.quotes.map(q => text(q.premium)) },
    { label: 'Policy Fee (AED)', values: comparison.quotes.map(q => text(q.policyFee)) }
  );

  if (!isGLPA) {
    rows.push({ label: 'VAT (5%)', values: comparison.quotes.map(q => `AED ${q.vat}`) });
  }

  rows.push({
    label: 'Total (AED)',
    isTotal: true,
    values: comparison.quotes.map(q => `AED ${q.total}`)
  });

  let sno = 0;
  return rows.map(row => {
    // Section bands (e.g. "C. Personal Accident") span the full width and
    // don't consume an S.No.
    if (row.isHeader) {
      return `<tr><td class="sno"></td><td class="particulars" colspan="${columnCount + 1}" style="background:#D9E1F2;">${row.label}</td></tr>`;
    }

    sno += 1;
    const rowStyle = row.isTotal ? ' style="background: #f0f8ff; font-weight: bold;"' : '';
    const lead = `<td class="sno">${sno}</td><td class="particulars">${row.label}</td>`;

    // Only merge when the collapse is lossless: every column carries identical text.
    const allMatch = columnCount > 1 && row.values.every(v => v === row.values[0]);
    if (isTravel && row.collapsible && allMatch) {
      return `<tr${rowStyle}>${lead}<td colspan="${columnCount}">${row.values[0]}</td></tr>`;
    }

    const cells = row.values.map((value, i) => {
      const cls = row.isTotal && comparison.quotes[i]?.isRecommended ? ' class="recommended"' : '';
      return `<td${cls}>${value}</td>`;
    }).join('');

    return `<tr${rowStyle}>${lead}${cells}</tr>`;
  }).join('');
};

// Travel prints ~36 rows. These overrides shrink the type and padding so the
// comparison still lands on a single page after the cover image.
const TRAVEL_COMPACT_CSS = `
        .container { padding: 8px; }
        .header { padding: 8px; margin-bottom: 8px; }
        .title { font-size: 16px; margin-bottom: 0; }
        .ref-date { font-size: 9px; margin-bottom: 6px; }
        .customer-details { padding: 8px; margin-bottom: 8px; }
        .customer-details h3 { font-size: 11px; padding-bottom: 3px; }
        .details-grid { font-size: 8px; gap: 4px; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); }
        table { font-size: 8px; margin-bottom: 8px; }
        th { padding: 3px 2px; font-size: 8px; }
        /* Company names are the key column labels — keep them a step larger than
           the body text even in the compact layout. Costs one row's height. */
        .company-header { font-size: 9.5px; padding: 5px 3px; line-height: 1.25; }
        td { padding: 1px 3px; font-size: 8px; line-height: 1.15; }
        .sno { width: 18px; }
        /* Benefit values are short (amounts, "Not Covered"), so give the label
           column enough width to stay on one line — a wrapped label doubles the
           height of every one of the ~36 rows. */
        .particulars { width: 200px; font-weight: bold; }
        .advisor-comment { padding: 6px; margin-top: 8px; font-size: 9px; }
        .advisor-comment h4 { font-size: 10px; margin-bottom: 2px; }
        .advisor-comment p { margin: 2px 0; }
        .summary { padding: 6px; margin-top: 6px; font-size: 8px; }
        .summary h3 { font-size: 10px; margin: 0 0 2px 0; padding-bottom: 2px; }
        .summary p { margin: 1px 0; }
        @media print {
            body { font-size: 8px; }
            .container { padding: 6px; }
            table { font-size: 7.5px; }
            td { padding: 1px 3px; font-size: 7.5px; line-height: 1.15; }
            th { padding: 3px 2px; font-size: 7.5px; }
            /* Let the cover image size to its content so it can't spill a blank page. */
            .page { min-height: auto; }
            .image-page { min-height: auto; padding: 10px; }
            .nsib-image { max-height: 60vh; }
        }
`;

// ============ QUOTE GENERATOR PAGE ============
function QuoteGeneratorPage({ 
  onSaveComplete, 
  editComparison, 
  onCancelEdit 
}: { 
  onSaveComplete?: (comparison: SavedComparison) => void;
  editComparison?: SavedComparison | null;
  onCancelEdit?: () => void;
}) {
  const [insuranceLine, setInsuranceLine] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [address, setAddress] = useState('');
  const [businessActivity, setBusinessActivity] = useState('');
  const [location, setLocation] = useState('');
  const [propertyLimit, setPropertyLimit] = useState('');
  const [enquiryNumber, setEnquiryNumber] = useState('');
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

  // Auto-load comparison when editComparison prop changes
  useEffect(() => {
    if (editComparison) {
      loadComparisonForEdit(editComparison);
    }
  }, [editComparison]);

  // Update available companies when insurance line changes
  useEffect(() => {
    if (insuranceLine) {
      const defaultCompanies = getInsuranceCompanies(insuranceLine);
      const allCompanies = [...defaultCompanies, ...customCompanies];
      setAvailableCompanies(allCompanies);
      setSelectedCompanies(defaultCompanies); // Start with default companies selected
    }
  }, [insuranceLine, customCompanies]);

  // Initialize quotes when selected companies change (but not during editing)
  useEffect(() => {
    if (insuranceLine && selectedCompanies.length > 0 && !isEditing) {
      const newQuotes = selectedCompanies.map(company => createEmptyQuote(company));
      setQuotes(newQuotes);
    }
  }, [selectedCompanies, insuranceLine]); // Removed isEditing dependency to prevent loop

  // Add new custom company
  const addCustomCompany = () => {
    if (newCompanyName.trim() && !availableCompanies.includes(newCompanyName.trim())) {
      const companyName = newCompanyName.trim();
      setCustomCompanies(prev => [...prev, companyName]);
      setNewCompanyName('');
      setShowAddCompany(false);
    }
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
    setInsuranceLine(insuranceLineValue);
    setCustomerName(comparison.customerName || '');
    setAddress(comparison.address || '');
    setBusinessActivity(comparison.businessActivity || '');
    setLocation(comparison.location || '');
    setPropertyLimit(comparison.propertyLimit || '');
    setEnquiryNumber(comparison.enquiryNumber || '');
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
    
    // Recalculate VAT and total if premium or policy fee changes
    if (field === 'premium' || field === 'policyFee') {
      const { vat, total } = calculateVAT(newQuotes[index].premium, newQuotes[index].policyFee, insuranceLine);
      newQuotes[index].vat = vat;
      newQuotes[index].total = total;
    }
    
    setQuotes(newQuotes);
  };

  const saveComparison = async () => {
    if (!insuranceLine) {
      alert('Please select an insurance line');
      return;
    }
    
    if (!customerName.trim()) {
      alert('Please enter customer name');
      return;
    }

    if (quotes.length === 0) {
      alert('Please add at least one quote');
      return;
    }

    const comparisonData = {
      id: isEditing && editingComparison ? editingComparison.id : generateId(),
      date: isEditing && editingComparison ? editingComparison.date : new Date().toISOString(),
      insuranceLine: INSURANCE_LINES.find(il => il.value === insuranceLine)?.label || insuranceLine,
      customerName,
      address,
      businessActivity,
      location,
      propertyLimit,
      enquiryNumber,
      // Filter out empty lines from conditions and exclusions when saving
      quotes: quotes.map(quote => ({
        ...quote,
        conditions: quote.conditions.filter(c => c.trim().length > 0),
        exclusions: quote.exclusions.filter(e => e.trim().length > 0)
      })),
      advisorComment,
      referenceNumber: isEditing && editingComparison ? editingComparison.referenceNumber : generateReferenceNumber()
    };

    // Save to shared Blob storage so every advisor sees the same history
    setSaving(true);
    try {
      const response = isEditing && editingComparison
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
    } catch (saveError) {
      console.error('❌ Save failed:', saveError);
      alert('❌ Failed to save comparison. Please check your connection and try again.');
      return;
    } finally {
      setSaving(false);
    }

    // Generate HTML file
    downloadComparison(comparisonData);

    // Reset form and edit state
    setIsEditing(false);
    setEditingComparison(null);
    resetForm();

    // Show success message
    const action = isEditing ? 'updated' : 'saved';
    
    // Trigger completion page
    if (onSaveComplete) {
      onSaveComplete(comparisonData);
    } else {
      alert(`✅ Comparison ${action} successfully!\nReference: ${comparisonData.referenceNumber}`);
    }
  };

  const resetForm = () => {
    setInsuranceLine('');
    setCustomerName('');
    setAddress('');
    setBusinessActivity('');
    setLocation('');
    setPropertyLimit('');
    setEnquiryNumber('');
    setAdvisorComment('');
    setQuotes([]);
    setAvailableCompanies([]);
    setSelectedCompanies([]);
    // Keep custom companies for future use unless explicitly cleared
    setNewCompanyName('');
    setShowAddCompany(false);
  };

  const downloadComparison = (comparison: SavedComparison) => {
    // Check if GLPA insurance for VAT handling
    const isGLPA = comparison.insuranceLine.includes('GLPA') || comparison.insuranceLine.includes('Group Life');
    const isTravel = comparison.insuranceLine.includes('TRAVEL');
    const tableBody = buildComparisonRows(comparison, isGLPA, isTravel);

    // Create HTML content with NSIB image as first page
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${comparison.insuranceLine} - Insurance Comparison</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
        .page { width: 100%; min-height: 100vh; page-break-after: always; padding: 20px; box-sizing: border-box; }
        .page:last-child { page-break-after: auto; }
        
        /* First Page - NSIB Image */
        .image-page { 
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            display: flex; 
            flex-direction: column; 
            align-items: center; 
            justify-content: center; 
            text-align: center;
            min-height: 100vh;
            padding: 20px;
        }
        .nsib-image {
            max-width: 95%;
            max-height: 85vh;
            width: auto;
            height: auto;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            margin-bottom: 20px;
        }
        .image-caption {
            font-size: 24px;
            font-weight: bold;
            color: #203864;
            margin-bottom: 10px;
        }
        .image-subtitle {
            font-size: 16px;
            color: #6c757d;
        }

        /* Second Page - Report Details */
        .report-page { 
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            display: flex; 
            flex-direction: column; 
            align-items: center; 
            justify-content: center; 
            text-align: center;
            min-height: 100vh;
            padding: 40px;
        }
        .report-title {
            font-size: 42px;
            font-weight: bold;
            color: #203864;
            margin-bottom: 20px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.1);
        }
        .report-subtitle {
            font-size: 24px;
            color: #4472C4;
            margin-bottom: 40px;
        }
        .report-details {
            background: rgba(255,255,255,0.95);
            padding: 30px;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            border: 2px solid #4472C4;
        }
        .report-details h3 {
            color: #203864;
            margin-top: 0;
            font-size: 28px;
            border-bottom: 2px solid #4472C4;
            padding-bottom: 10px;
        }
        .report-details p {
            color: #495057;
            margin: 15px 0;
            font-size: 18px;
            font-weight: 500;
        }
        .report-footer {
            margin-top: 50px;
            color: #6c757d;
            font-size: 16px;
        }

        /* Third Page - Comparison Data */
        .comparison-page { background: #f8f9fa; }
        .container { max-width: 100%; margin: 0; padding: 15px; }
        .header { text-align: center; background: linear-gradient(135deg, #4472C4, #203864); color: white; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
        .title { font-size: 22px; font-weight: bold; margin-bottom: 8px; }
        .ref-date { display: flex; justify-content: space-between; margin-bottom: 15px; font-weight: bold; font-size: 14px; }
        .customer-details { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px; page-break-inside: avoid; }
        .customer-details h3 { color: #203864; border-bottom: 2px solid #4472C4; padding-bottom: 5px; margin-top: 0; font-size: 16px; }
        .details-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; font-size: 13px; }
        .detail-item { }
        .detail-label { font-weight: bold; color: #555; }
        .detail-value { color: #333; }
        
        /* Optimized table for single page */
        table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-bottom: 20px;
            font-size: 11px;
            /* Travel adds ~27 benefit rows, which cannot fit on one page. */
            page-break-inside: ${isTravel ? 'auto' : 'avoid'};
        }
        th { 
            background: #4472C4; 
            color: white; 
            padding: 8px 4px; 
            text-align: center; 
            border: 1px solid #ddd; 
            font-weight: bold; 
            font-size: 11px;
        }
        td { 
            padding: 6px 4px; 
            border: 1px solid #ddd; 
            vertical-align: top; 
            font-size: 10px;
            line-height: 1.3;
        }
        .sno { text-align: center; font-weight: bold; background: #f8f9fa; width: 40px; }
        .particulars { font-weight: bold; background: #f8f9fa; width: 120px; }
        .company-header { background: #D9E1F2; font-weight: bold; text-align: center; }
        /* th sets color:white, but .sno/.particulars/.company-header each override
           the background to a light colour without resetting the text colour, which
           left every header cell white-on-near-white. Restore the solid blue band
           the th rule already intended, so company names read clearly. */
        thead th,
        thead th.sno,
        thead th.particulars,
        thead th.company-header { background: #4472C4; color: #ffffff; }
        .recommended { background: #fff3cd; border-left: 4px solid #ffc107; }
        .advisor-comment { background: #FFC000; color: #333; padding: 10px; border-radius: 8px; margin-top: 15px; font-size: 12px; }
        .advisor-comment h4 { margin-top: 0; color: #333; font-size: 13px; }
        .summary { background: #e8f5e8; padding: 15px; border-radius: 8px; margin-top: 20px; font-size: 12px; }
        
        @media print {
            body { margin: 0; font-size: 10px; }
            .container { padding: 10px; }
            table { font-size: 9px; }
            td { padding: 4px 2px; }
            th { padding: 6px 2px; }
        }
${isTravel ? TRAVEL_COMPACT_CSS : ''}
    </style>
</head>
<body>
    <!-- FIRST PAGE: NSIB IMAGE -->
    <div class="page image-page">
        <img src="https://i.imgur.com/j0pz4Ll.png" alt="NSIB - New Shield Insurance Brokers" class="nsib-image" />
        <div class="image-caption">NEW SHIELD INSURANCE BROKERS L.L.C.</div>
        <div class="image-subtitle">Professional Insurance Solutions</div>
    </div>

    <!-- SECOND PAGE: Comparison Details -->
    <div class="page comparison-page">
        <div class="container">
            <div class="header">
                <div class="title">${comparison.insuranceLine.toUpperCase()} - INSURANCE COMPARISON</div>
            </div>
            
            <div class="ref-date">
                <span>Reference: ${comparison.referenceNumber}</span>
                <span>Date: ${comparison.date.substring(0, 10)}</span>
            </div>

            <div class="customer-details">
                <h3>Customer Information</h3>
                <div class="details-grid">
                    <div class="detail-item">
                        <div class="detail-label">Customer Name:</div>
                        <div class="detail-value">${comparison.customerName || 'N/A'}</div>
                    </div>
                    ${comparison.address ? `
                    <div class="detail-item">
                        <div class="detail-label">Address:</div>
                        <div class="detail-value">${comparison.address}</div>
                    </div>` : ''}
                    ${comparison.businessActivity ? `
                    <div class="detail-item">
                        <div class="detail-label">Business Activity:</div>
                        <div class="detail-value">${comparison.businessActivity}</div>
                    </div>` : ''}
                    ${comparison.location ? `
                    <div class="detail-item">
                        <div class="detail-label">Location/Premises:</div>
                        <div class="detail-value">${comparison.location}</div>
                    </div>` : ''}
                    ${comparison.enquiryNumber ? `
                    <div class="detail-item">
                        <div class="detail-label">Enquiry Number:</div>
                        <div class="detail-value">${comparison.enquiryNumber}</div>
                    </div>` : ''}
                    ${comparison.propertyLimit ? `
                    <div class="detail-item">
                        <div class="detail-label">Property Limit:</div>
                        <div class="detail-value">${comparison.propertyLimit}</div>
                    </div>` : ''}
                </div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th class="sno">S.No.</th>
                        <th class="particulars">Particulars</th>
                        ${comparison.quotes.map(quote => `<th class="company-header">${quote.company}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>${tableBody}</tbody>
            </table>

            ${comparison.advisorComment ? `
            <div class="advisor-comment">
                <h4>Advisor Comment:</h4>
                <p>${comparison.advisorComment}</p>
            </div>` : ''}

            <div class="summary">
                <h3>Summary</h3>
                <p><strong>Insurance Line:</strong> ${comparison.insuranceLine}</p>
                <p><strong>Companies Compared:</strong> ${comparison.quotes.length}</p>
                <p><strong>Recommended Option:</strong> ${comparison.quotes.find(q => q.isRecommended)?.company || 'None marked'}</p>
                <p><strong>Generated:</strong> ${new Date().toLocaleDateString('en-GB')} by NSIB General Insurance Quote System</p>
            </div>
        </div>
    </div>
</body>
</html>`;

    // Create and download HTML file
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `insurance_comparison_${comparison.referenceNumber}.html`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

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
            {/* Customer Details */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-lg font-bold mb-3 text-gray-800">Customer Details</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-1 text-gray-800">Customer Name *</label>
                  <input
                    type="text"
                    className="w-full p-2 border-2 border-gray-300 rounded text-gray-900 bg-white focus:border-indigo-500 focus:outline-none"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Enter customer name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold mb-1 text-gray-800">Address</label>
                  <input
                    type="text"
                    className="w-full p-2 border-2 border-gray-300 rounded text-gray-900 bg-white focus:border-indigo-500 focus:outline-none"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Enter address"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold mb-1 text-gray-800">Business Activity</label>
                  <input
                    type="text"
                    className="w-full p-2 border-2 border-gray-300 rounded text-gray-900 bg-white focus:border-indigo-500 focus:outline-none"
                    value={businessActivity}
                    onChange={(e) => setBusinessActivity(e.target.value)}
                    placeholder="Enter business activity"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold mb-1 text-gray-800">Location / Premises (Risk Address)</label>
                  <input
                    type="text"
                    className="w-full p-2 border-2 border-gray-300 rounded text-gray-900 bg-white focus:border-indigo-500 focus:outline-none"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Enter location"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold mb-1 text-gray-800">Enquiry Number</label>
                  <input
                    type="text"
                    className="w-full p-2 border-2 border-gray-300 rounded text-gray-900 bg-white focus:border-indigo-500 focus:outline-none"
                    value={enquiryNumber}
                    onChange={(e) => setEnquiryNumber(e.target.value)}
                    placeholder="Enter enquiry number"
                  />
                </div>

                {(insuranceLine === 'par' || insuranceLine === 'sme') && (
                  <div>
                    <label className="block text-sm font-bold mb-1 text-gray-800">Property Insured - Limit</label>
                    <input
                      type="text"
                      className="w-full p-2 border-2 border-gray-300 rounded text-gray-900 bg-white focus:border-indigo-500 focus:outline-none"
                      value={propertyLimit}
                      onChange={(e) => setPropertyLimit(e.target.value)}
                      placeholder="Enter property limit (e.g., AED 1,000,000)"
                    />
                  </div>
                )}
              </div>
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
                            placeholder="e.g., 0.5% of sum insured"
                          />
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
                          {insuranceLine === 'glpa' ? (
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
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Advisor Comment */}
            <div className="mb-6 p-4 bg-yellow-50 rounded-lg border-2 border-yellow-300">
              <label className="block text-sm font-bold mb-2 text-gray-800">Advisor Comment</label>
              <textarea
                className="w-full p-3 border-2 border-gray-300 rounded text-gray-900 bg-white focus:border-yellow-500 focus:outline-none"
                value={advisorComment}
                onChange={(e) => setAdvisorComment(e.target.value)}
                rows={4}
                placeholder="Add any special notes, recommendations, or important information for the client..."
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                onClick={saveComparison}
                disabled={saving}
                className="flex-1 bg-green-600 text-white p-4 rounded-lg font-bold text-lg hover:bg-green-700 transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving
                  ? '⏳ Saving...'
                  : isEditing ? '💾 Save Changes & Download' : '💾 Save & Download Comparison'}
              </button>
              <button
                onClick={resetForm}
                disabled={saving}
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

  useEffect(() => {
    loadHistory();
    setLocalCount(readLocalHistory().length);
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

  const downloadComparison = (comparison: SavedComparison) => {
    // Same download function as main generator with NSIB image first
    const isGLPA = comparison.insuranceLine.includes('GLPA') || comparison.insuranceLine.includes('Group Life');
    const isTravel = comparison.insuranceLine.includes('TRAVEL');
    const tableBody = buildComparisonRows(comparison, isGLPA, isTravel);

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${comparison.insuranceLine} - Insurance Comparison</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
        .page { width: 100%; min-height: 100vh; page-break-after: always; padding: 20px; box-sizing: border-box; }
        .page:last-child { page-break-after: auto; }
        
        /* First Page - NSIB Image */
        .image-page { 
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            display: flex; flex-direction: column; align-items: center; justify-content: center; 
            text-align: center; min-height: 100vh; padding: 20px;
        }
        .nsib-image { max-width: 95%; max-height: 85vh; width: auto; height: auto; border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); margin-bottom: 20px; }
        .image-caption { font-size: 24px; font-weight: bold; color: #203864; margin-bottom: 10px; }
        .image-subtitle { font-size: 16px; color: #6c757d; }

        /* Remaining styles same as before for comparison pages... */
        .report-page { background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; min-height: 100vh; padding: 40px; }
        .report-title { font-size: 42px; font-weight: bold; color: #203864; margin-bottom: 20px; text-shadow: 2px 2px 4px rgba(0,0,0,0.1); }
        .report-subtitle { font-size: 24px; color: #4472C4; margin-bottom: 40px; }
        .report-details { background: rgba(255,255,255,0.95); padding: 30px; border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); border: 2px solid #4472C4; }
        .report-details h3 { color: #203864; margin-top: 0; font-size: 28px; border-bottom: 2px solid #4472C4; padding-bottom: 10px; }
        .report-details p { color: #495057; margin: 15px 0; font-size: 18px; font-weight: 500; }
        .report-footer { margin-top: 50px; color: #6c757d; font-size: 16px; }
        .comparison-page { background: #f8f9fa; }
        .container { max-width: 100%; margin: 0; padding: 15px; }
        .header { text-align: center; background: linear-gradient(135deg, #4472C4, #203864); color: white; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
        .title { font-size: 22px; font-weight: bold; margin-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px; page-break-inside: ${isTravel ? 'auto' : 'avoid'}; }
        th { background: #4472C4; color: white; padding: 8px 4px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 11px; }
        td { padding: 6px 4px; border: 1px solid #ddd; vertical-align: top; font-size: 10px; line-height: 1.3; }
        .sno { text-align: center; font-weight: bold; background: #f8f9fa; width: 40px; }
        .particulars { font-weight: bold; background: #f8f9fa; width: 120px; }
        .company-header { background: #D9E1F2; font-weight: bold; text-align: center; }
        /* th sets color:white, but .sno/.particulars/.company-header each override
           the background to a light colour without resetting the text colour, which
           left every header cell white-on-near-white. Restore the solid blue band
           the th rule already intended, so company names read clearly. */
        thead th,
        thead th.sno,
        thead th.particulars,
        thead th.company-header { background: #4472C4; color: #ffffff; }
        .recommended { background: #fff3cd; border-left: 4px solid #ffc107; }
        .summary { background: #e8f5e8; padding: 15px; border-radius: 8px; margin-top: 20px; font-size: 12px; }
${isTravel ? TRAVEL_COMPACT_CSS : ''}
    </style>
</head>
<body>
    <div class="page image-page">
        <img src="https://i.imgur.com/Qgh7Try.jpeg" alt="NSIB - New Shield Insurance Brokers" class="nsib-image" />
        <div class="image-caption">NEW SHIELD INSURANCE BROKERS L.L.C.</div>
        <div class="image-subtitle">Professional Insurance Solutions</div>
    </div>



    <div class="page comparison-page">
        <div class="container">
            <div class="header"><div class="title">${comparison.insuranceLine.toUpperCase()} - INSURANCE COMPARISON</div></div>
            <table>
                <thead><tr><th class="sno">S.No.</th><th class="particulars">Particulars</th>${comparison.quotes.map(quote => `<th class="company-header">${quote.company}</th>`).join('')}</tr></thead>
                <tbody>${tableBody}</tbody>
            </table>
            <div class="summary"><h3>Summary</h3><p><strong>Generated:</strong> ${new Date().toLocaleDateString('en-GB')} by NSIB General Insurance Quote System</p></div>
        </div>
    </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `insurance_comparison_${comparison.referenceNumber}.html`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="grid grid-cols-1 gap-5">
      <div className="bg-white rounded-xl p-5 shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Saved History</h2>
            <p className="text-sm text-gray-600">☁️ Shared across all advisors</p>
          </div>
          <button
            onClick={loadHistory}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? '🔄 Loading...' : '🔄 Refresh'}
          </button>
        </div>
        
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
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {history.map(comparison => (
              <div key={comparison.id} className="bg-gradient-to-br from-gray-50 to-gray-100 p-5 rounded-lg border-2 border-gray-200 hover:border-indigo-400 transition shadow-sm hover:shadow-md">
                <div className="mb-3">
                  <div className="font-bold text-lg text-indigo-700">{comparison.insuranceLine}</div>
                  <div className="font-semibold text-gray-900">{comparison.customerName}</div>
                  <div className="text-xs text-gray-500">{formatDate(comparison.date)}</div>
                  <div className="text-xs text-indigo-600 font-mono">Ref: {comparison.referenceNumber}</div>
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
                    onClick={() => downloadComparison(comparison)} 
                    className="bg-purple-600 text-white px-3 py-2 rounded text-sm font-bold hover:bg-purple-700 transition"
                  >
                    📥 Download
                  </button>
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
            onSaveComplete={(comparison) => {
              setCompletedComparison(comparison);
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
