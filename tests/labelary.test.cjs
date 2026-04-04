const assert = require("node:assert/strict");

const { convertPdfToZpl } = require("../lib/labelary.ts");

async function run() {
  {
    const zpl = "^XA\n^FO20,20^ADN,36,20^FDTEST^FS\n^XZ";
    const result = await convertPdfToZpl(Buffer.from(zpl, "utf8"));

    assert.equal(result, zpl);
  }

  {
    await assert.rejects(
      () => convertPdfToZpl(Buffer.from("%PDF-1.4 fake label", "utf8")),
      /Labelary renders ZPL into PDF\/PNG but cannot convert PDF back into ZPL/
    );
  }
}

module.exports = { run };
