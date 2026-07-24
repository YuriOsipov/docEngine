declare module 'pdfmake' {
  const PdfPrinter: any;
  export default PdfPrinter;
}

declare module 'pdfmake/build/pdfmake.js' {
  const pdfMake: any;
  export default pdfMake;
}

declare module 'pdfmake/build/vfs_fonts.js' {
  const pdfFonts: any;
  export default pdfFonts;
}

declare module 'pdfmake/interfaces.js' {
  export type TDocumentDefinitions = Record<string, any>;
}
