// The minified browser bundle is a UMD file whose `module.exports` is the
// pdfmake instance. Its methods live on the prototype, so after CJS interop
// they are reachable only through the default export, which @types/pdfmake
// (named exports of the package) does not describe.
declare module 'pdfmake/build/pdfmake.min.js' {
  import type { createPdf, setFonts } from 'pdfmake/build/pdfmake';

  const pdfMake: { createPdf: typeof createPdf; setFonts: typeof setFonts };
  export default pdfMake;
}
