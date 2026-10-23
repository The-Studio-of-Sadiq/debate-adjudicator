import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

/**
 * Render the report to a PDF and open the share sheet (save to Files, send on
 * WhatsApp, email…). Resolves with the PDF's URI.
 */
export async function exportPdf(html: string, _fileName: string, dialogTitle: string): Promise<string | null> {
  // A4 at 72 PPI.
  const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle });
  return uri;
}
