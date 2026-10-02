import regularUrl from '~/assets/fonts/ibm-plex-sans/IBMPlexSans-Regular.ttf?url';
import italicUrl from '~/assets/fonts/ibm-plex-sans/IBMPlexSans-Italic.ttf?url';
import semiBoldUrl from '~/assets/fonts/ibm-plex-sans/IBMPlexSans-SemiBold.ttf?url';
import boldUrl from '~/assets/fonts/ibm-plex-sans/IBMPlexSans-Bold.ttf?url';
import { PDF_FONT, PDF_FONT_SEMIBOLD } from './build-client-report-pdf';

type PdfMake = (typeof import('pdfmake/build/pdfmake.min.js'))['default'];

let loading: Promise<PdfMake> | null = null;

/**
 * Loads pdfmake on first use (design D1) and registers IBM Plex Sans (D4).
 * pdfmake fetches the absolute font URLs into its virtual file system when a
 * document is first rendered, so fonts are downloaded only on export.
 */
export function loadPdfMake(): Promise<PdfMake> {
  // The constant `import.meta.client` branch keeps pdfmake out of the server build.
  loading ??= (
    import.meta.client
      ? import('pdfmake/build/pdfmake.min.js')
      : Promise.reject(new Error('pdfmake is browser-only'))
  ).then(({ default: pdfMake }) => {
    const url = (path: string) => new URL(path, window.location.href).href;
    pdfMake.setFonts({
      [PDF_FONT]: {
        normal: url(regularUrl),
        bold: url(boldUrl),
        italics: url(italicUrl),
        bolditalics: url(boldUrl),
      },
      [PDF_FONT_SEMIBOLD]: {
        normal: url(semiBoldUrl),
        bold: url(semiBoldUrl),
        italics: url(semiBoldUrl),
        bolditalics: url(semiBoldUrl),
      },
    });
    return pdfMake;
  });
  // A failed chunk load (e.g. offline) must not poison later exports.
  loading.catch(() => {
    loading = null;
  });
  return loading;
}
