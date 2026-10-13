// Zoho CRM + WorkDrive access for the API routes. Server-only: import this from
// app/api/** and nowhere the browser bundle can reach.
//
// Authentication is a Zoho "Self Client" refresh token, exchanged for a
// short-lived access token on demand. The client secret and refresh token live
// only in the server's environment — never prefix them with NEXT_PUBLIC_, which
// would bundle them into the browser build.
//
// Scopes the refresh token needs:
//   ZohoCRM.coql.READ, ZohoCRM.modules.deals.READ, ZohoCRM.modules.contacts.READ,
//   WorkDrive.files.CREATE  (contacts: the search reads the enquiry's contact name)

import type { WorkDriveResult } from './types';

const ACCOUNTS_URL = process.env.ZOHO_ACCOUNTS_URL || 'https://accounts.zoho.com';
const API_URL = process.env.ZOHO_API_URL || 'https://www.zohoapis.com';

// "Enquiries" in the CRM UI is the renamed Deals module.
export const ENQUIRY_MODULE = 'Deals';
export const FOLDER_ID_FIELD = 'zohoworkdriveforcrm__Workdrive_Folder_ID';
export const FOLDER_URL_FIELD = 'zohoworkdriveforcrm__Workdrive_Folder_URL';

// Access tokens last an hour. Keep one per warm instance so a burst of
// searches doesn't hit Zoho's token endpoint, which is rate limited.
let cached = { token: '', expiresAt: 0 };

async function accessToken(): Promise<string> {
  if (cached.token && Date.now() < cached.expiresAt) return cached.token;

  const { ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN } = process.env;
  if (!ZOHO_CLIENT_ID || !ZOHO_CLIENT_SECRET || !ZOHO_REFRESH_TOKEN) {
    throw new Error('Zoho is not configured on the server (see .env.example).');
  }

  const res = await fetch(`${ACCOUNTS_URL}/oauth/v2/token`, {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: ZOHO_CLIENT_ID,
      client_secret: ZOHO_CLIENT_SECRET,
      refresh_token: ZOHO_REFRESH_TOKEN,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) {
    throw new Error(`Zoho sign-in failed: ${body.error || res.status}`);
  }
  // Refresh a minute early so a token never expires mid-request.
  cached = {
    token: body.access_token,
    expiresAt: Date.now() + ((body.expires_in || 3600) - 60) * 1000,
  };
  return cached.token;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function zohoFetch(path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { ...init.headers, Authorization: `Zoho-oauthtoken ${await accessToken()}` },
    cache: 'no-store',
  });
  // CRM answers an empty result with 204 and no body.
  if (res.status === 204) return {};
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = body.message || body.code || body.errors?.[0]?.title || res.status;
    throw new Error(`Zoho request failed: ${detail}`);
  }
  return body;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function coql(selectQuery: string): Promise<any[]> {
  const body = await zohoFetch('/crm/v7/coql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ select_query: selectQuery }),
  });
  return body.data || [];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getEnquiry(id: string): Promise<Record<string, any> | null> {
  const fields = ['Enquiry_No1', 'Deal_Name', FOLDER_ID_FIELD, FOLDER_URL_FIELD].join(',');
  const body = await zohoFetch(
    `/crm/v7/${ENQUIRY_MODULE}/${encodeURIComponent(id)}?fields=${fields}`
  );
  return body.data?.[0] || null;
}

// Files a comparison PDF in its enquiry's WorkDrive folder. Never throws: the
// outcome is reported so a failed filing doesn't cost the advisor the PDF.
//
// The folder is read from the enquiry in Zoho, never taken from the request,
// and the file name is built here, so a caller can only file into a folder that
// belongs to a real enquiry, under a name of our choosing.
export async function fileComparisonPdf(
  enquiryId: string,
  reference: string,
  pdf: Buffer
): Promise<WorkDriveResult> {
  try {
    if (!/^\d{6,25}$/.test(enquiryId)) throw new Error('Invalid enquiry id.');
    if (!/^[\w-]{1,40}$/.test(reference)) throw new Error('Invalid comparison reference.');

    const enquiry = await getEnquiry(enquiryId);
    if (!enquiry) throw new Error('The enquiry was not found in Zoho.');
    const folderId = enquiry[FOLDER_ID_FIELD];
    if (!folderId) throw new Error(`${enquiry.Enquiry_No1 || 'This enquiry'} has no WorkDrive folder yet.`);

    // Named by the comparison's reference, not the date, so saving the same
    // comparison again replaces its file (see uploadToWorkDrive) while other
    // comparisons for the enquiry keep files of their own.
    const base = `NSIB_Comparison_${reference}.pdf`;
    const name = enquiry.Enquiry_No1 ? `${enquiry.Enquiry_No1}_${base}` : base;
    const file = await uploadToWorkDrive(folderId, name, new Blob([new Uint8Array(pdf)], { type: 'application/pdf' }));
    return { ok: true, enquiryNo: enquiry.Enquiry_No1 || '', ...file };
  } catch (error) {
    console.error('WorkDrive filing failed:', error);
    return { ok: false, error: error instanceof Error ? error.message : 'Could not save to WorkDrive.' };
  }
}

// Uploads a file into a WorkDrive folder. A file of the same name already
// there is replaced: WorkDrive stores the upload as its newest version and
// keeps the earlier ones in the file's version history, so an updated
// comparison supersedes the old one without losing what was sent before.
export async function uploadToWorkDrive(
  folderId: string,
  filename: string,
  content: Blob
): Promise<{ fileId: string; fileName: string; link: string }> {
  const form = new FormData();
  form.append('content', content, filename);
  form.append('filename', filename);
  form.append('parent_id', folderId);
  form.append('override-name-exist', 'true');

  const body = await zohoFetch('/workdrive/api/v1/upload', { method: 'POST', body: form });
  const attrs = body.data?.[0]?.attributes || {};
  return {
    fileId: attrs.resource_id || '',
    fileName: attrs.FileName || filename,
    link: attrs.Permalink || `https://workdrive.zoho.com/folder/${folderId}`,
  };
}
