import type { WorkDriveResult, ZohoEnquiry } from './types';

// Browser side of the Zoho integration. Nothing here talks to Zoho directly:
// every call goes through our own /api routes, which hold the Zoho keys. Filing
// in WorkDrive happens on the server as the PDF is made (see /api/render-pdf).

// Returns { enquiries } or { error }, never throws — the picker shows the error
// inline and the advisor can carry on without an enquiry.
export async function searchEnquiries(q: string): Promise<{ enquiries: ZohoEnquiry[]; error?: string }> {
  try {
    const res = await fetch(`/api/zoho/enquiries?${new URLSearchParams({ q })}`, { cache: 'no-store' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { enquiries: [], error: body.error || `Search failed (${res.status}).` };
    return { enquiries: body.enquiries || [] };
  } catch {
    return { enquiries: [], error: 'Zoho search is unavailable. Check your connection.' };
  }
}

// The WorkDrive half of a save message: says plainly whether the PDF reached
// the enquiry's folder, since an advisor will assume it did.
export const workDriveNote = (enquiry: ZohoEnquiry | null | undefined, result: WorkDriveResult | null) => {
  if (!enquiry) return '';
  if (!result) return 'Not saved to WorkDrive — the PDF server did not say whether it was filed.';
  if (result.ok) return `Saved to WorkDrive under ${result.enquiryNo || enquiry.enquiryNo}.`;
  return `Not saved to WorkDrive: ${'error' in result ? result.error : 'unknown error'}`;
};
