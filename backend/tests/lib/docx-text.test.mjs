// .docx text extraction for CV ingest: the CLI's read-only Read tool rejects
// binary files, so the route extracts Word CVs to text before prompting.
//
// Run:  node --test tests/lib/docx-text.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import zlib from "node:zlib";
import { docxToText, documentXmlToText, readZipEntry } from "../../src/lib/docx-text.mjs";

/** Minimal zip writer: enough structure for readZipEntry (central directory + local headers). */
function makeZip(entries, { deflate = true } = {}) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, content] of Object.entries(entries)) {
    const nameBuf = Buffer.from(name, "utf8");
    const raw = Buffer.from(content, "utf8");
    const data = deflate ? zlib.deflateRawSync(raw) : raw;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(deflate ? 8 : 0, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    locals.push(local, nameBuf, data);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(deflate ? 8 : 0, 10);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);
    offset += 30 + nameBuf.length + data.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(Object.keys(entries).length, 8);
  eocd.writeUInt16LE(Object.keys(entries).length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, eocd]);
}

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const doc = (body) => `<?xml version="1.0"?><w:document ${W}><w:body>${body}</w:body></w:document>`;
const para = (...runs) => `<w:p>${runs.map((r) => `<w:r><w:t xml:space="preserve">${r}</w:t></w:r>`).join("")}</w:p>`;

test("extracts paragraphs from a deflated word/document.xml", () => {
  const zip = makeZip({
    "[Content_Types].xml": "<Types/>",
    "word/document.xml": doc(para("Jane Doe") + para("Senior ", "Engineer") + para("Acme &amp; Co &#8212; 2020&#x2013;2024")),
  });
  assert.equal(docxToText(zip), "Jane Doe\nSenior Engineer\nAcme & Co — 2020–2024");
});

test("reads stored (uncompressed) entries too", () => {
  const zip = makeZip({ "word/document.xml": doc(para("Stored")) }, { deflate: false });
  assert.equal(docxToText(zip), "Stored");
});

test("keeps line breaks, tabs and table cells readable", () => {
  const xml = doc(
    '<w:p><w:r><w:t>A</w:t><w:br/><w:t>B</w:t><w:tab/><w:t>C</w:t></w:r></w:p>' +
      "<w:tbl><w:tr><w:tc>" + para("Python") + "</w:tc><w:tc>" + para("Go") + "</w:tc></w:tr></w:tbl>",
  );
  assert.equal(documentXmlToText(xml), "A\nB\tC\nPython\n\tGo");
});

test("returns null for anything that is not a readable .docx", () => {
  assert.equal(docxToText(Buffer.from("%PDF-1.7 not a zip")), null);
  assert.equal(docxToText(makeZip({ "other.xml": "<x/>" })), null);
  assert.equal(docxToText(makeZip({ "word/document.xml": doc("") })), null);
  assert.equal(readZipEntry(Buffer.alloc(0), "word/document.xml"), null);
});
