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
  enquiryNumber?: string;
}
