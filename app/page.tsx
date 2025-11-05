// app/page.tsx
'use client';

import { useState, useEffect } from 'react';

// ============ TYPES ============
interface Quote {
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
}

interface SavedComparison {
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
}

// ============ CONSTANTS ============
const INSURANCE_LINES = [
  { value: 'sme', label: 'SME PACKAGE (PAR + TPL + WC EL)' },
  { value: 'par', label: 'PAR - Property All Risk Insurance' },
  { value: 'tpl', label: 'TPL - Third Party Liability Insurance' },
  { value: 'wcel', label: 'WC EL - Workmen\'s Compensation and Employer\'s Liability' },
  { value: 'car', label: 'CAR - Contractor\'s All Risk' },
  { value: 'cpm', label: 'CPM - Contractor\'s Plant and Machinery Insurance' },
  { value: 'glpa', label: 'GLPA - Group Life and Personal Accident Insurance' }
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
      "Tennent's liability",
      "Cross Liability Clause",
      "Including liability arising from bodily injury",
      "Including liability arising from Fire and/or explosion",
      "Including pollution caused by accidental and sudden discharge",
      "Including Tenants Liability up to the policy limits",
      "Legal & Defense costs included within the Limits of Indemnity",
      "Waiver of subrogation against insured parties"
    ],
    "exclusions": [
      "War Risks, Pollution Risk, Nuclear Risk",
      "Coronavirus exclusion - Communicable disease exclusion",
      "Professional Liability",
      "Contractual Liability",
      "Product Liability (unless specified)"
    ],
    "deductible": "AED 1,000/- each and every claim"
  },
  "wcel": {
    "companies": ["AWNIC", "Sukoon", "ORIENT", "AIG"],
    "scopeOfCover": "Workmen's Compensation as per UAE Labor Law / Employer's Liability as per Common and/or Sharia Law : Occurrence Form",
    "geographicalLimits": "United Arab Emirates",
    "conditions": [
      "Repatriation Expenses - AED 35,000 per person including accompanying person",
      "Employer's Liability with a limit of AED 1,000,000/- AOO",
      "Defense costs within limits",
      "Including 24 hours non-work related accidents",
      "Including transportation of employees to and from work place",
      "Including work during overtime and public holidays",
      "Including Sunstroke and Hernia resulting from work related activities",
      "Employee to Employee Liability Clause",
      "Accidental Medical Expenses - AED 50,000/- per person"
    ],
    "exclusions": [
      "War Risks, Pollution Risk, Nuclear Risk",
      "Coronavirus exclusion - Communicable disease exclusion",
      "Any offshore works / works on ships etc.",
      "Pure Financial Loss/ Consequential Loss"
    ],
    "deductible": "As per policy terms"
  },
  "car": {
    "companies": ["Sukoon", "AWNIC", "ORIENT", "UNION"],
    "scopeOfCover": "Combined single limit for Death/Bodily injury and TPPD as per Munich Re Contractor's All Risks Policy wordings",
    "geographicalLimits": "United Arab Emirates",
    "conditions": [
      "Cover for Cross Liability - (Mre 002)",
      "Extended Maintenance Cover: 6 months (Mre 004)",
      "Cover for Extra Charges for Overtime, Night work, Express Freight: upto 5% (Mre 006)",
      "Special conditions concerning Underground Cables, Pipes & other facilities-Mre102",
      "Warranty Concerning Construction Material - (Mre 009)",
      "Safety Measures with respect to flood and inundation - (Mre 110)",
      "Cover for Vibration, Removal or Weakening of Support upto AED 500,000/-",
      "Fire Fighting Facilities & Fire Safety on Construction Sites",
      "Professional Fees Clause - Upto 5% of the Claim Amount",
      "Debris Removal Clause - Upto 10% of the Claim Amount"
    ],
    "exclusions": [
      "War Risks, Pollution Risk, Nuclear Risk",
      "Existing structures and surrounding properties",
      "Design errors and defects",
      "Pure Financial Loss/ Consequential Loss"
    ],
    "deductible": "As per project specifications"
  },
  "cpm": {
    "companies": ["AWNIC", "IH", "DNIRC", "NGI"],
    "scopeOfCover": "Contractors Plant & Equipment against any unforeseen and sudden physical loss or damage from any cause not specifically excluded under the Policy. As per Standard policy wording of Munich re.",
    "geographicalLimits": "United Arab Emirates",
    "conditions": [
      "Cover extended to include Tool of Trade Extension up to a limit of AED 1,000,000/-",
      "Debris Removal 10% of the claim Amount subject to maximum AED 100,000/-",
      "Extended to cover Riot & Strike, civil Commotion",
      "Inland Transit Clause - Including Loading and Unloading",
      "Cover of Any extra charges incurred overtime, night work, work on public holidays",
      "Coverage for loading / unloading / dismantling / Erection / commissioning & testing",
      "Including loss or damage due to Fire, Lightning, explosion, storm and tempest",
      "Temporary removal - Limit 10% of Sum Insured"
    ],
    "exclusions": [
      "War Risks, Pollution Risk, Nuclear Risk",
      "Coronavirus exclusion - Communicable disease exclusion",
      "Mechanical or electrical breakdown (unless Breakdown cover included)",
      "Normal wear and tear"
    ],
    "deductible": "As per policy terms"
  },
  "glpa": {
    "companies": ["ABNIC", "ALLIANCE", "ORIENT", "UNION"],
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
  }
};

// Get insurance companies for selected line
const getInsuranceCompanies = (insuranceLine: string): string[] => {
  return INSURANCE_DEFAULTS[insuranceLine]?.companies || [];
};

// Get default values for insurance line
const getLineDefaults = (insuranceLine: string) => {
  return INSURANCE_DEFAULTS[insuranceLine] || {
    companies: [],
    scopeOfCover: '',
    geographicalLimits: 'United Arab Emirates',
    conditions: [],
    exclusions: [],
    deductible: ''
  };
};

// ============ UTILITY FUNCTIONS ============
const calculateVAT = (premium: number, policyFee: number = 0) => {
  const subtotal = premium + policyFee;
  const vat = subtotal * 0.05;
  const total = subtotal + vat;
  return { vat: parseFloat(vat.toFixed(2)), total: parseFloat(total.toFixed(2)) };
};

const generateId = () => Math.random().toString(36).substr(2, 9);

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('en-GB', { 
    day: '2-digit', 
    month: 'short', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const generateReferenceNumber = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `GI-${year}${month}${day}-${random}`;
};

// ============ QUOTE GENERATOR PAGE ============
function QuoteGeneratorPage({ onSaveComplete }: { onSaveComplete?: (comparison: SavedComparison) => void }) {
  const [insuranceLine, setInsuranceLine] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [address, setAddress] = useState('');
  const [businessActivity, setBusinessActivity] = useState('');
  const [location, setLocation] = useState('');
  const [propertyLimit, setPropertyLimit] = useState('');
  const [advisorComment, setAdvisorComment] = useState('');
  
  const [availableCompanies, setAvailableCompanies] = useState<string[]>([]);
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);

  // Update available companies when insurance line changes
  useEffect(() => {
    if (insuranceLine) {
      const companies = getInsuranceCompanies(insuranceLine);
      setAvailableCompanies(companies);
      setSelectedCompanies(companies); // Select all by default
    }
  }, [insuranceLine]);

  // Initialize quotes when selected companies change
  useEffect(() => {
    if (insuranceLine && selectedCompanies.length > 0) {
      const newQuotes = selectedCompanies.map(company => createEmptyQuote(company));
      setQuotes(newQuotes);
    }
  }, [selectedCompanies]);

  const createEmptyQuote = (company: string): Quote => {
    const defaults = getLineDefaults(insuranceLine);
    
    return {
      id: generateId(),
      company,
      scopeOfCover: defaults.scopeOfCover || 'All assets of the Insured',
      geographicalLimits: defaults.geographicalLimits || 'United Arab Emirates',
      conditions: [...defaults.conditions],
      exclusions: [...defaults.exclusions],
      deductible: defaults.deductible || '',
      premiumRate: '',
      premium: 0,
      policyFee: 0,
      vat: 0,
      total: 0,
      isRecommended: false
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
      const { vat, total } = calculateVAT(newQuotes[index].premium, newQuotes[index].policyFee);
      newQuotes[index].vat = vat;
      newQuotes[index].total = total;
    }
    
    setQuotes(newQuotes);
  };

  const toggleCondition = (quoteIndex: number, condition: string) => {
    const newQuotes = [...quotes];
    const currentConditions = newQuotes[quoteIndex].conditions;
    
    if (currentConditions.includes(condition)) {
      newQuotes[quoteIndex].conditions = currentConditions.filter(c => c !== condition);
    } else {
      newQuotes[quoteIndex].conditions = [...currentConditions, condition];
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

    const comparison: SavedComparison = {
      id: generateId(),
      date: new Date().toISOString(),
      insuranceLine: INSURANCE_LINES.find(il => il.value === insuranceLine)?.label || insuranceLine,
      customerName,
      address,
      businessActivity,
      location,
      propertyLimit,
      quotes,
      advisorComment,
      referenceNumber: generateReferenceNumber()
    };

    // Save to localStorage
    const history = JSON.parse(localStorage.getItem('generalInsuranceHistory') || '[]');
    history.unshift(comparison);
    localStorage.setItem('generalInsuranceHistory', JSON.stringify(history));

    // Generate HTML file
    downloadComparison(comparison);

    // Reset form
    resetForm();

    // Trigger completion page with your image
    if (onSaveComplete) {
      onSaveComplete(comparison);
    } else {
      alert(`✅ Comparison saved successfully!\nReference: ${comparison.referenceNumber}`);
    }
  };

  const resetForm = () => {
    setInsuranceLine('');
    setCustomerName('');
    setAddress('');
    setBusinessActivity('');
    setLocation('');
    setPropertyLimit('');
    setAdvisorComment('');
    setQuotes([]);
    setAvailableCompanies([]);
    setSelectedCompanies([]);
  };

  const downloadComparison = (comparison: SavedComparison) => {
    // Create HTML content with branding page first
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
        
        /* First Page - Branding */
        .branding-page { 
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            display: flex; 
            flex-direction: column; 
            align-items: center; 
            justify-content: center; 
            text-align: center;
            min-height: 100vh;
            padding: 40px;
        }
        .branding-page img { 
            max-width: 90%; 
            max-height: 80vh; 
            width: auto; 
            height: auto; 
            border-radius: 15px; 
            box-shadow: 0 10px 30px rgba(0,0,0,0.2); 
            margin-bottom: 30px;
        }
        .branding-title {
            font-size: 36px;
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 15px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.1);
        }
        .branding-subtitle {
            font-size: 20px;
            color: #7f8c8d;
            margin-bottom: 30px;
        }
        .branding-footer {
            background: rgba(255,255,255,0.9);
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }
        .branding-footer h3 {
            color: #2c3e50;
            margin-top: 0;
            font-size: 24px;
        }
        .branding-footer p {
            color: #34495e;
            margin: 10px 0;
            font-size: 16px;
        }

        /* Second Page - Comparison Data */
        .comparison-page { background: #f8f9fa; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { text-align: center; background: linear-gradient(135deg, #4472C4, #203864); color: white; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
        .title { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
        .ref-date { display: flex; justify-content: space-between; margin-bottom: 20px; font-weight: bold; }
        .customer-details { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
        .customer-details h3 { color: #203864; border-bottom: 2px solid #4472C4; padding-bottom: 5px; }
        .details-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
        .detail-item { }
        .detail-label { font-weight: bold; color: #555; }
        .detail-value { color: #333; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        th { background: #4472C4; color: white; padding: 15px 10px; text-align: center; border: 1px solid #ddd; font-weight: bold; }
        td { padding: 12px 10px; border: 1px solid #ddd; vertical-align: top; }
        .sno { text-align: center; font-weight: bold; background: #f8f9fa; }
        .particulars { font-weight: bold; background: #f8f9fa; }
        .company-header { background: #D9E1F2; font-weight: bold; text-align: center; }
        .recommended { background: #fff3cd; border-left: 4px solid #ffc107; }
        .conditions-list, .exclusions-list { font-size: 12px; line-height: 1.4; }
        .conditions-list li, .exclusions-list li { margin-bottom: 3px; }
        .advisor-comment { background: #FFC000; color: #333; padding: 15px; border-radius: 8px; margin-top: 20px; }
        .advisor-comment h4 { margin-top: 0; color: #333; }
        .summary { background: #e8f5e8; padding: 20px; border-radius: 8px; margin-top: 30px; }
        
        @media print { 
            body { margin: 0; } 
            .page { margin: 0; padding: 20px; }
            .container { box-shadow: none; } 
        }
    </style>
</head>
<body>
    <!-- FIRST PAGE: NSIB Branding -->
    <div class="page branding-page">
        <div class="branding-title">NEW SHIELD INSURANCE BROKERS L.L.C.</div>
        <div class="branding-subtitle">Professional Insurance Solutions</div>
        
        <img src="https://i.imgur.com/Qgh7Try.jpeg" alt="NSIB - New Shield Insurance Brokers" />
        
        <div class="branding-footer">
            <h3>Insurance Comparison Report</h3>
            <p><strong>Reference:</strong> ${comparison.referenceNumber}</p>
            <p><strong>Insurance Line:</strong> ${comparison.insuranceLine}</p>
            <p><strong>Customer:</strong> ${comparison.customerName}</p>
            <p><strong>Generated:</strong> ${new Date().toLocaleDateString('en-GB')}</p>
            <p><strong>Companies Compared:</strong> ${comparison.quotes.length}</p>
        </div>
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
                        <th style="width: 80px;">S.No.</th>
                        <th style="width: 200px;">Particulars</th>
                        ${comparison.quotes.map(quote => `<th class="company-header">${quote.company}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td class="sno">1</td>
                        <td class="particulars">Scope of Cover</td>
                        ${comparison.quotes.map(quote => `<td>${quote.scopeOfCover}</td>`).join('')}
                    </tr>
                    <tr>
                        <td class="sno">2</td>
                        <td class="particulars">Geographical Limits</td>
                        ${comparison.quotes.map(quote => `<td>${quote.geographicalLimits}</td>`).join('')}
                    </tr>
                    <tr>
                        <td class="sno">3</td>
                        <td class="particulars">Conditions/Extensions</td>
                        ${comparison.quotes.map(quote => `
                            <td>
                                <ul class="conditions-list">
                                    ${quote.conditions.map(condition => `<li>• ${condition}</li>`).join('')}
                                </ul>
                            </td>
                        `).join('')}
                    </tr>
                    <tr>
                        <td class="sno">4</td>
                        <td class="particulars">Main Exclusions</td>
                        ${comparison.quotes.map(quote => `
                            <td>
                                <ul class="exclusions-list">
                                    ${quote.exclusions.map(exclusion => `<li>• ${exclusion}</li>`).join('')}
                                </ul>
                            </td>
                        `).join('')}
                    </tr>
                    <tr>
                        <td class="sno">5</td>
                        <td class="particulars">Deductible</td>
                        ${comparison.quotes.map(quote => `<td>${quote.deductible}</td>`).join('')}
                    </tr>
                    <tr>
                        <td class="sno">6</td>
                        <td class="particulars">Premium Rate</td>
                        ${comparison.quotes.map(quote => `<td>${quote.premiumRate}</td>`).join('')}
                    </tr>
                    <tr>
                        <td class="sno">7</td>
                        <td class="particulars">Premium (AED)</td>
                        ${comparison.quotes.map(quote => `<td>${quote.premium}</td>`).join('')}
                    </tr>
                    <tr>
                        <td class="sno">8</td>
                        <td class="particulars">Policy Fee (AED)</td>
                        ${comparison.quotes.map(quote => `<td>${quote.policyFee}</td>`).join('')}
                    </tr>
                    <tr>
                        <td class="sno">9</td>
                        <td class="particulars">VAT (5%)</td>
                        ${comparison.quotes.map(quote => `<td>AED ${quote.vat}</td>`).join('')}
                    </tr>
                    <tr style="background: #f0f8ff; font-weight: bold;">
                        <td class="sno">10</td>
                        <td class="particulars">Total (AED)</td>
                        ${comparison.quotes.map(quote => `<td${quote.isRecommended ? ' class="recommended"' : ''}>AED ${quote.total}</td>`).join('')}
                    </tr>
                </tbody>
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
        <h2 className="text-2xl font-bold mb-4 text-gray-800">General Insurance Quote Generator</h2>
        
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
                <h3 className="text-lg font-bold mb-3 text-gray-800">Select Insurance Companies</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {availableCompanies.map(company => (
                    <label key={company} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedCompanies.includes(company)}
                        onChange={() => handleCompanyToggle(company)}
                        className="w-5 h-5"
                      />
                      <span className="text-sm font-semibold text-gray-800">{company}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-600 mt-2">✓ {selectedCompanies.length} of {availableCompanies.length} companies selected • Select/deselect to customize comparison</p>
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
                          <div className="grid grid-cols-1 gap-2 bg-white p-2 rounded border max-h-40 overflow-y-auto">
                            {getLineDefaults(insuranceLine).conditions.map((condition, condIdx) => (
                              <label key={condIdx} className="flex items-center gap-2 text-xs text-gray-800 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={quote.conditions.includes(condition)}
                                  onChange={() => toggleCondition(idx, condition)}
                                />
                                <span>{condition}</span>
                              </label>
                            ))}
                          </div>
                          <p className="text-xs text-gray-500 mt-1">✓ {quote.conditions.length} conditions selected</p>
                        </div>

                        <div>
                          <label className="block text-xs font-bold mb-1 text-gray-800">Main Exclusions</label>
                          <div className="bg-red-50 p-2 rounded border border-red-200 max-h-32 overflow-y-auto">
                            <div className="text-xs text-gray-700">
                              {quote.exclusions.map((exclusion, exIdx) => (
                                <div key={exIdx} className="mb-1">• {exclusion}</div>
                              ))}
                            </div>
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
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold mb-1 text-gray-800">Policy Fee (AED)</label>
                            <input
                              type="number"
                              className="w-full p-2 border-2 border-gray-300 rounded text-xs text-gray-900 bg-white focus:border-indigo-500 focus:outline-none"
                              value={quote.policyFee}
                              onChange={(e) => updateQuote(idx, 'policyFee', parseFloat(e.target.value) || 0)}
                            />
                          </div>
                        </div>

                        <div className="bg-indigo-50 p-2 rounded">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-bold text-gray-700">VAT (5%):</span>
                            <span className="font-bold text-gray-900">AED {quote.vat.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm border-t border-indigo-200 pt-1">
                            <span className="font-bold text-indigo-700">Total:</span>
                            <span className="font-bold text-indigo-700">AED {quote.total.toFixed(2)}</span>
                          </div>
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
                className="flex-1 bg-green-600 text-white p-4 rounded-lg font-bold text-lg hover:bg-green-700 transition shadow-lg"
              >
                💾 Save & Download Comparison
              </button>
              <button
                onClick={resetForm}
                className="bg-gray-500 text-white px-6 p-4 rounded-lg font-bold hover:bg-gray-600 transition"
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
function SavedHistoryPage() {
  const [history, setHistory] = useState<SavedComparison[]>([]);
  const [editingComparison, setEditingComparison] = useState<SavedComparison | null>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = () => {
    const saved = localStorage.getItem('generalInsuranceHistory');
    if (saved) {
      setHistory(JSON.parse(saved));
    }
  };

  const deleteComparison = (id: string) => {
    if (confirm('Are you sure you want to delete this comparison?')) {
      const newHistory = history.filter(c => c.id !== id);
      localStorage.setItem('generalInsuranceHistory', JSON.stringify(newHistory));
      setHistory(newHistory);
    }
  };

  const downloadComparisonFromHistory = async (comparison: SavedComparison) => {
    // Reuse the download function from QuoteGeneratorPage
    // Implementation would be similar
    alert('Download feature - Excel file generation');
  };

  return (
    <div className="grid grid-cols-1 gap-5">
      <div className="bg-white rounded-xl p-5 shadow-2xl">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">Saved History</h2>
        <p className="text-sm text-gray-600 mb-4">📁 All comparisons are saved locally</p>
        
        {history.length === 0 ? (
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
                    onClick={() => downloadComparisonFromHistory(comparison)} 
                    className="flex-1 bg-purple-600 text-white px-3 py-2 rounded text-sm font-bold hover:bg-purple-700 transition"
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
            }}
          />
        ) : (
          <SavedHistoryPage />
        )}
      </div>
    </div>
  );
}
