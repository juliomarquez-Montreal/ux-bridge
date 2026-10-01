// @types/pdf-parse só declara o módulo "pdf-parse" (o index.js do pacote) —
// importamos o arquivo interno direto (lib/pbiStyle/extractFileText.ts) pra
// evitar um bug conhecido do pacote sob webpack, então precisamos espelhar
// o mesmo tipo pra esse subcaminho.
declare module "pdf-parse/lib/pdf-parse.js" {
  import PdfParse = require("pdf-parse");
  export = PdfParse;
}
