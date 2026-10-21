export interface Quote {
  id: string;
  company: string;
  scopeOfCover: string;
  geographicalLimits: string;
  conditions: string[];
  exclusions: string[];
  deductible: string;
  premiumRate: string;
  // GLPA / WC EL / PI: whether the rate is per cent (÷ 100) or per mille (÷ 1000).
  // Missing on older quotes, which were all per cent.
  rateBasis?: 100 | 1000;
  premium: number;
  policyFee: number;
  vat: number;
  total: number;
  isRecommended: boolean;
  // Date this insurer's quote is valid until, as yyyy-mm-dd. Each insurer
  // sets its own, so it lives on the quote rather than the comparison.
  quoteValidity?: string;
  // Travel line only — the Schedule of Benefits column for this insurer.
  // Optional so every previously saved quote (which has no benefits) still loads.
  benefits?: { label: string; value: string }[];
}

export interface SavedComparison {
  id: string;
  date: string;
  insuranceLine: string;
  customerName: string;
  quotes: Quote[];
  advisorComment?: string;
  referenceNumber: string;
  fileUrl?: string;
  // Additional fields based on insurance line
  address?: string;
  businessActivity?: string;
  location?: string;
  // Legacy (PAR / SME): replaced by Sum Insured on 2026-10-21. Older records
  // may still hold it; it is read as their sum insured.
  propertyLimit?: string;
  // Shown as "Sum Insured". Every line since 2026-10-21; before that only
  // GLPA, WC EL and PI carried it, so older records may not have it.
  totalSumInsured?: string;
  // Policy period as yyyy-mm-dd, from the form's date pickers.
  policyFrom?: string;
  policyTo?: string;
  // Optional; printed below the table when filled.
  remarks?: string;
  // GLPA and WC EL only.
  numberOfEmployees?: string;
  // Printed on the document. Set from the linked Zoho enquiry when there is
  // one; older comparisons hold a number typed in by hand and no `enquiry`.
  enquiryNumber?: string;
  // The Zoho CRM enquiry this comparison is filed under in WorkDrive.
  enquiry?: ZohoEnquiry | null;
}

// A Zoho CRM enquiry (the Deals module) as the picker shows it — no premiums,
// commissions or notes leave the server.
export interface ZohoEnquiry {
  id: string;
  enquiryNo: string;
  enquiryName: string;
  contactName: string;
  insuranceType: string;
  subType?: string;
  enquiryDate?: string;
  stage?: string;
  hasFolder: boolean;
  folderUrl: string;
}

// What filing a PDF in WorkDrive came to.
export type WorkDriveResult =
  | { ok: true; enquiryNo: string; fileId: string; fileName: string; link: string }
  | { ok: false; error: string };
