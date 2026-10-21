// Plain-text extraction from a .docx, with no dependencies.
//
// WHY: CV ingest used to hand the .docx path to the CLI, but the CLI runs with a
// read-only Read/Glob/Grep scope and Read rejects binary files, so every Word CV
// came back `unreadable`. A .docx is a zip whose body text lives in
// word/document.xml; pulling it out here lets the CLI get the CV as text, the same
// way a pasted CV arrives, and makes Word upload work for any CLI, not just Claude.
import zlib from "node:zlib";

const EOCD_SIG = 0x06054b50;
const CENTRAL_SIG = 0x02014b50;
const LOCAL_SIG = 0x04034b50;

/** Bytes of one zip entry, or null when absent. Supports stored and deflated entries. */
export function readZipEntry(buf, name) {
  // The end-of-central-directory record sits in the last 22 bytes + up to 64 KiB of comment.
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count && p + 46 <= buf.length; n++) {
    if (buf.readUInt32LE(p) !== CENTRAL_SIG) return null;
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const entryName = buf.toString("utf8", p + 46, p + 46 + nameLen);
    if (entryName === name) {
      if (buf.readUInt32LE(localOff) !== LOCAL_SIG) return null;
      const start = localOff + 30 + buf.readUInt16LE(localOff + 26) + buf.readUInt16LE(localOff + 28);
      const data = buf.subarray(start, start + compSize);
      if (method === 0) return Buffer.from(data);
      if (method === 8) return zlib.inflateRawSync(data);
      return null;
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/** WordprocessingML body XML → plain text, one line per paragraph. */
export function documentXmlToText(xml) {
  return xml
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<w:(br|cr)\b[^>]*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<\/w:tc>/g, "\t") // table cells stay on one line, tab-separated
    .replace(/<[^>]+>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => {
      if (e[0] === "#") {
        const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : m;
      }
      return ENTITIES[e] ?? m;
    })
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Text of a .docx file's main body, or null when it isn't a readable .docx. */
export function docxToText(buf) {
  try {
    const xml = readZipEntry(buf, "word/document.xml");
    if (!xml) return null;
    const text = documentXmlToText(xml.toString("utf8"));
    return text || null;
  } catch {
    return null;
  }
}
