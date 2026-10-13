'use client';

import { useEffect, useRef, useState } from 'react';
import type { ZohoEnquiry } from '../lib/types';
import { searchEnquiries } from '../lib/zoho-client';

// Links the comparison to a Zoho CRM enquiry. The customer name (or, on an
// older comparison, the enquiry number typed in by hand) drives the search as
// it's entered, so the matching enquiries are waiting by the time the advisor
// looks; typing in the box searches by any name or enquiry number instead.
//
// The advisor always picks the enquiry — nothing is chosen automatically. One
// client often has several enquiries, and filing a comparison under the wrong
// one puts it in another client's WorkDrive folder.

const Badge = ({ className, children }: { className: string; children: React.ReactNode }) => (
  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full text-white whitespace-nowrap ${className}`}>
    {children}
  </span>
);

export default function EnquiryPicker({
  defaultQuery,
  enquiry,
  onSelect,
  disabled = false,
}: {
  defaultQuery: string;
  enquiry: ZohoEnquiry | null;
  onSelect: (enquiry: ZohoEnquiry | null) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState('');
  // Once the advisor types in the box, stop overwriting it from the customer name.
  const [typed, setTyped] = useState(false);
  const [results, setResults] = useState<ZohoEnquiry[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // Responses can arrive out of order; only the latest search may update the list.
  const latest = useRef(0);

  // An emptied box falls back to the customer name rather than searching
  // nothing, so clearing it never leaves the advisor with no list and no reason.
  const effectiveQuery = ((typed && query.trim()) || defaultQuery || '').trim();

  useEffect(() => {
    if (enquiry) return undefined;
    if (effectiveQuery.length < 3) {
      latest.current += 1; // drop any search still in flight
      setResults([]);
      setError('');
      setLoading(false);
      return undefined;
    }
    const id = ++latest.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      const res = await searchEnquiries(effectiveQuery);
      if (id !== latest.current) return;
      setResults(res.enquiries);
      setError(res.error || '');
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [effectiveQuery, enquiry]);

  if (enquiry) {
    return (
      <div className="flex items-center justify-between gap-3 flex-wrap p-3 rounded-lg border-2 border-indigo-200 bg-indigo-50">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-extrabold text-sm text-indigo-700">{enquiry.enquiryNo}</span>
            <span className="text-sm font-semibold text-gray-800 truncate">
              {enquiry.contactName || enquiry.enquiryName}
            </span>
            {!enquiry.hasFolder && <Badge className="bg-amber-700">No WorkDrive folder</Badge>}
          </div>
          <div className="text-xs text-gray-500 truncate">
            {enquiry.enquiryName}
            {enquiry.insuranceType ? ` · ${enquiry.insuranceType}` : ''}
            {enquiry.hasFolder ? ' · the PDF will be saved to this enquiry’s WorkDrive' : ''}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {enquiry.folderUrl && (
            <a
              href={enquiry.folderUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 text-xs font-bold rounded bg-indigo-600 text-white hover:bg-indigo-700 transition"
            >
              📁 WorkDrive
            </a>
          )}
          <button
            type="button"
            onClick={() => onSelect(null)}
            disabled={disabled}
            className="px-3 py-1.5 text-xs font-bold rounded border-2 border-gray-300 text-gray-600 bg-white hover:bg-gray-100 transition disabled:opacity-50"
          >
            Change
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <input
        type="text"
        className="w-full p-2 border-2 border-gray-300 rounded text-gray-900 bg-white focus:border-indigo-500 focus:outline-none"
        value={typed ? query : defaultQuery}
        onChange={(e) => {
          setTyped(true);
          setQuery(e.target.value);
        }}
        disabled={disabled}
        placeholder="Search by client name or enquiry number (e.g. Enq298581)"
      />
      <div className="text-[11px] text-gray-500 mt-1">
        {loading
          ? 'Searching Zoho…'
          : error
            ? <span className="text-red-700">{error}</span>
            : effectiveQuery.length < 3
              ? 'Enter the customer name, or type here, to find the Zoho enquiry.'
              : results.length
                ? `${results.length} enquir${results.length === 1 ? 'y' : 'ies'} found — pick the right one.`
                : 'No matching enquiries in Zoho.'}
        {typed && (
          <button
            type="button"
            className="ml-2 underline"
            onClick={() => {
              setTyped(false);
              setQuery('');
            }}
          >
            use customer name
          </button>
        )}
      </div>

      {results.length > 0 && (
        <div className="mt-2 max-h-64 overflow-y-auto space-y-1.5 pr-1">
          {results.map((e) => (
            <button
              type="button"
              key={e.id}
              onClick={() => onSelect(e)}
              disabled={disabled}
              className="w-full text-left p-2.5 rounded border-2 border-gray-200 bg-white hover:border-indigo-400 transition disabled:opacity-50"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-sm text-indigo-700">{e.enquiryNo}</span>
                <span className="text-sm font-semibold text-gray-800">{e.contactName || e.enquiryName}</span>
                {e.insuranceType === 'General' && <Badge className="bg-blue-600">General</Badge>}
                {!e.hasFolder && <Badge className="bg-amber-700">No WorkDrive folder</Badge>}
              </div>
              <div className="text-xs text-gray-500">
                {[e.enquiryName, e.insuranceType, e.subType, e.stage, e.enquiryDate].filter(Boolean).join(' · ')}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
