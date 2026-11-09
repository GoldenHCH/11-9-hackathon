import { ToolError } from '../tools/tool-errors';
import { importLimits } from './profile.constants';

export async function pdfToText(bytes: Uint8Array): Promise<string> {
  if (bytes.byteLength > importLimits.MAX_PDF_BYTES) {
    throw new ToolError(413, 'file_too_large', 'That PDF is over 5 MB. Try a shorter export, or paste the text instead.');
  }

  if (Buffer.from(bytes.subarray(0, 5)).toString('latin1') !== '%PDF-') {
    throw new ToolError(415, 'not_a_pdf', 'That file is not a PDF. Upload a PDF, or paste the text instead.');
  }

  try {
    const { extractText, getDocumentProxy } = await import('unpdf');
    const document = await getDocumentProxy(bytes);
    const { text } = await extractText(document, { mergePages: true });

    return text.slice(0, importLimits.MAX_TEXT_CHARS * 2);
  } catch {
    throw new ToolError(422, 'unreadable_pdf', 'We could not read that PDF. Paste the text instead, or skip this step.');
  }
}
