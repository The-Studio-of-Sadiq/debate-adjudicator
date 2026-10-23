/** Exposed by apps/desktop/preload.js. */
interface PdfBridge {
  /** Renders the HTML to PDF and asks where to save it; null if cancelled. */
  save(html: string, fileName: string): Promise<string | null>;
}

const bridge = (globalThis as { debatePdf?: PdfBridge }).debatePdf;

/**
 * Windows app: save dialog, then the saved path. Plain browser: open the
 * report and let the browser's print dialog save it as PDF.
 */
export async function exportPdf(html: string, fileName: string, _dialogTitle: string): Promise<string | null> {
  if (bridge) return bridge.save(html, fileName);
  const win = window.open('', '_blank');
  if (!win) throw new Error('Pop-up blocked');
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
  return null;
}
