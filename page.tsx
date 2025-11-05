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
function QuoteGeneratorPage() {
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

    // Generate Excel file
    await downloadComparison(comparison);

    alert(`✅ Comparison saved successfully!\nReference: ${comparison.referenceNumber}`);
    
    // Reset form
    resetForm();
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

  const downloadComparison = async (comparison: SavedComparison) => {
    // Create Excel file using openpyxl
    const code = `
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
import json

# Load comparison data
comparison = json.loads('''${JSON.stringify(comparison).replace(/'/g, "\\'")}''')

# Create workbook
wb = openpyxl.Workbook()
ws = wb.active
ws.title = "Comparison"

# Styles
header_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
header_font = Font(bold=True, color="FFFFFF", size=12)
subheader_fill = PatternFill(start_color="D9E1F2", end_color="D9E1F2", fill_type="solid")
subheader_font = Font(bold=True, size=11)
border = Border(
    left=Side(style='thin'),
    right=Side(style='thin'),
    top=Side(style='thin'),
    bottom=Side(style='thin')
)

# Title
ws.merge_cells('A1:F1')
ws['A1'] = f"{comparison['insuranceLine']} - Insurance Comparison"
ws['A1'].font = Font(bold=True, size=14, color="FFFFFF")
ws['A1'].fill = PatternFill(start_color="203864", end_color="203864", fill_type="solid")
ws['A1'].alignment = Alignment(horizontal='center', vertical='center')
ws.row_dimensions[1].height = 25

# Reference and Date
row = 2
ws[f'A{row}'] = f"Reference: {comparison['referenceNumber']}"
ws[f'A{row}'].font = Font(bold=True, size=10)
ws[f'D{row}'] = f"Date: {comparison['date'][:10]}"
ws[f'D{row}'].font = Font(bold=True, size=10)
row += 1

# Customer Details
ws[f'A{row}'] = "Customer Name:"
ws[f'A{row}'].font = subheader_font
ws[f'B{row}'] = comparison.get('customerName', '')
row += 1

if comparison.get('address'):
    ws[f'A{row}'] = "Address:"
    ws[f'A{row}'].font = subheader_font
    ws[f'B{row}'] = comparison['address']
    row += 1

if comparison.get('businessActivity'):
    ws[f'A{row}'] = "Business Activity:"
    ws[f'A{row}'].font = subheader_font
    ws[f'B{row}'] = comparison['businessActivity']
    row += 1

if comparison.get('location'):
    ws[f'A{row}'] = "Location/Premises:"
    ws[f'A{row}'].font = subheader_font
    ws[f'B{row}'] = comparison['location']
    row += 1

if comparison.get('propertyLimit'):
    ws[f'A{row}'] = "Property Limit:"
    ws[f'A{row}'].font = subheader_font
    ws[f'B{row}'] = comparison['propertyLimit']
    row += 1

row += 1

# Headers
headers = ['S.No.', 'Particulars']
for quote in comparison['quotes']:
    headers.append(quote['company'])

col = 1
for header in headers:
    cell = ws.cell(row, col, header)
    cell.font = header_font
    cell.fill = header_fill
    cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
    cell.border = border
    col += 1

header_row = row
row += 1

# Quote details
details = [
    ('Scope of Cover', 'scopeOfCover'),
    ('Geographical Limits', 'geographicalLimits'),
    ('Deductible', 'deductible'),
    ('Premium Rate', 'premiumRate'),
    ('Premium (AED)', 'premium'),
    ('Policy Fee (AED)', 'policyFee'),
    ('VAT 5% (AED)', 'vat'),
    ('Total (AED)', 'total')
]

sno = 1
for label, field in details:
    ws.cell(row, 1, sno)
    ws.cell(row, 2, label)
    ws.cell(row, 2).font = Font(bold=True)
    
    col = 3
    for quote in comparison['quotes']:
        value = quote.get(field, '')
        if field in ['premium', 'policyFee', 'vat', 'total'] and isinstance(value, (int, float)):
            ws.cell(row, col, value)
            ws.cell(row, col).number_format = '#,##0.00'
        else:
            ws.cell(row, col, str(value))
        ws.cell(row, col).border = border
        
        # Highlight recommended
        if quote.get('isRecommended') and field == 'total':
            ws.cell(row, col).fill = PatternFill(start_color="C6EFCE", end_color="C6EFCE", fill_type="solid")
            ws.cell(row, col).font = Font(bold=True, color="006100")
        
        col += 1
    
    ws.cell(row, 1).border = border
    ws.cell(row, 2).border = border
    sno += 1
    row += 1

# Conditions
ws.cell(row, 1, sno)
ws.cell(row, 2, "Conditions/Extensions")
ws.cell(row, 2).font = Font(bold=True)
ws.cell(row, 1).border = border
ws.cell(row, 2).border = border

col = 3
for quote in comparison['quotes']:
    conditions_text = "\\n".join([f"• {c}" for c in quote.get('conditions', [])])
    cell = ws.cell(row, col, conditions_text)
    cell.alignment = Alignment(wrap_text=True, vertical='top')
    cell.border = border
    col += 1
row += 1
sno += 1

# Exclusions
ws.cell(row, 1, sno)
ws.cell(row, 2, "Main Exclusions")
ws.cell(row, 2).font = Font(bold=True)
ws.cell(row, 1).border = border
ws.cell(row, 2).border = border

col = 3
for quote in comparison['quotes']:
    exclusions_text = "\\n".join([f"• {e}" for e in quote.get('exclusions', [])])
    cell = ws.cell(row, col, exclusions_text)
    cell.alignment = Alignment(wrap_text=True, vertical='top')
    cell.border = border
    col += 1
row += 1

# Advisor Comment
if comparison.get('advisorComment'):
    row += 1
    ws.merge_cells(f'A{row}:B{row}')
    ws[f'A{row}'] = "Advisor Comment:"
    ws[f'A{row}'].font = Font(bold=True, size=11, color="FFFFFF")
    ws[f'A{row}'].fill = PatternFill(start_color="FFC000", end_color="FFC000", fill_type="solid")
    row += 1
    ws.merge_cells(f'A{row}:{chr(65+len(comparison['quotes'])+1)}{row}')
    ws[f'A{row}'] = comparison['advisorComment']
    ws[f'A{row}'].alignment = Alignment(wrap_text=True, vertical='top')
    ws.row_dimensions[row].height = 50

# Adjust column widths
ws.column_dimensions['A'].width = 8
ws.column_dimensions['B'].width = 30
for i in range(len(comparison['quotes'])):
    ws.column_dimensions[chr(67+i)].width = 35

# Save
wb.save('/mnt/user-data/outputs/general_insurance_comparison.xlsx')
print("Excel file created successfully")
`;

    try {
      const response = await fetch('/api/generate-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `general_insurance_${comparison.referenceNumber}.xlsx`;
        a.click();
      }
    } catch (error) {
      console.error('Error generating Excel:', error);
    }
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
  const [currentPage, setCurrentPage] = useState<'generator' | 'history'>('generator');

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

        {currentPage === 'generator' ? <QuoteGeneratorPage /> : <SavedHistoryPage />}
      </div>
    </div>
  );
}
