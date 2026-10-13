export interface Quote {
  id: string;
  company: string;
  scopeOfCover: string;
  geographicalLimits: string;
  conditions: string[];
  exclusions: string[];
  deductible: string;
  premiumRate: string;
  premium: number;
  policyFee: number;
  vat: number;
  total: number;
  isRecommended: boolean;
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
  propertyLimit?: string;
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
