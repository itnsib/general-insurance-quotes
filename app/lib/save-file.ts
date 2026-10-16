// ============================================================================
// Saving a file where the user chooses, rather than straight to Downloads
// ============================================================================
// Chromium-based browsers expose the File System Access API, whose
// showSaveFilePicker() opens the OS "Save as" dialog — the advisor picks the
// folder and the file name before anything is written.
//
// Firefox and Safari have no such API, so there we fall back to the classic
// anchor download and the file lands wherever the browser puts downloads.

type SaveFilePicker = (options: {
  suggestedName?: string;
  types?: { description: string; accept: Record<string, string[]> }[];
}) => Promise<{
  createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }>;
}>;

const extensionOf = (filename: string) => {
  const dot = filename.lastIndexOf('.');
  return dot > 0 ? filename.slice(dot).toLowerCase() : '';
};

// Writes `blob` to a location the user chooses.
// Returns 'saved' | 'cancelled' | 'fallback': a cancelled save is a deliberate
// act, not a failure, and must NOT then drop the file into Downloads anyway.
export const saveBlobAs = async (blob: Blob, filename: string) => {
  const picker = (window as unknown as { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker;

  if (typeof picker === 'function') {
    const ext = extensionOf(filename);
    try {
      const handle = await picker({
        suggestedName: filename,
        types: ext
          ? [{ description: `${ext.slice(1).toUpperCase()} file`, accept: { [blob.type || 'application/octet-stream']: [ext] } }]
          : undefined,
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return 'saved' as const;
    } catch (error) {
      // The user closed the dialog — stop here, deliberately.
      if ((error as { name?: string })?.name === 'AbortError') return 'cancelled' as const;
      // Anything else (blocked by policy, insecure context, an iframe): fall
      // through to the anchor so the download still works.
      console.warn('showSaveFilePicker failed, falling back to a direct download:', error);
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return 'fallback' as const;
};
