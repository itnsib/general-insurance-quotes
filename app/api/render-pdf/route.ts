import { NextResponse } from 'next/server';
import { renderPdf } from '../../lib/pdf';
import { fileComparisonPdf } from '../../lib/zoho';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Cold start has to unpack Chromium, so allow well beyond the default.
export const maxDuration = 60;

// POST /api/render-pdf  { html, filename, enquiryId?, reference?, workdriveOnly? }
//
// Turns the comparison document into a PDF. A comparison tied to a Zoho enquiry
// is also filed in that enquiry's WorkDrive folder; the advisor still gets the
// PDF if filing fails, and the outcome travels back in a header so the page
// can say which happened. workdriveOnly files it and answers with the outcome
// alone, for an advisor who doesn't want another copy on their machine.

// The document's images are site paths, not inlined, so even a long comparison
// is well under this.
const MAX_HTML_CHARS = 2_000_000;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const { html, filename, enquiryId, reference, workdriveOnly = false } = body || {};

  if (typeof html !== 'string' || !html) {
    return NextResponse.json({ error: 'A "html" string is required.' }, { status: 400 });
  }
  if (html.length > MAX_HTML_CHARS) {
    return NextResponse.json({ error: 'The document is too large.' }, { status: 413 });
  }
  // WorkDrive-only filing has nowhere to file without an enquiry.
  if (workdriveOnly && !enquiryId) {
    return NextResponse.json({ error: 'An enquiry is required to save to WorkDrive.' }, { status: 400 });
  }
  // Only characters that are safe inside the Content-Disposition header.
  const name = /^[\w.-]{1,80}\.pdf$/.test(String(filename || '')) ? String(filename) : 'comparison.pdf';

  let pdf: Buffer;
  try {
    pdf = await renderPdf(html);
  } catch (error) {
    console.error('render-pdf failed:', error);
    const message = error instanceof Error ? error.message : 'PDF rendering failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const workdrive = enquiryId ? await fileComparisonPdf(String(enquiryId), String(reference || ''), pdf) : null;
  if (workdriveOnly) return NextResponse.json({ workdrive });

  const headers: Record<string, string> = {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${name}"`,
    'Content-Length': String(pdf.length),
  };
  if (workdrive) headers['X-WorkDrive-Result'] = encodeURIComponent(JSON.stringify(workdrive));
  return new NextResponse(new Uint8Array(pdf), { status: 200, headers });
}
