import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';
import yauzl from 'yauzl';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import KnowledgeSource from '../../models/KnowledgeSource.js';
import { uploadsRootPath } from '../../middleware/upload.js';
import { fail, SOURCE_TYPES } from './schema.js';

export const hash = (value) =>
  crypto.createHash('sha256').update(value).digest('hex');

export const sourcePath = (userId, source) =>
  path.join(
    uploadsRootPath,
    'knowledge',
    String(userId),
    `${source._id}.${source.format}`
  );

export async function extractPages(buffer, format) {
  if (buffer.length > 10 * 1024 * 1024)
    throw fail(413, 'Each source must be at most 10 MB');

  if (format === 'txt') return [{ page: 1, text: buffer.toString('utf8') }];
  if (buffer.subarray(0, 5).toString() !== '%PDF-')
    throw fail(400, 'Invalid PDF header');

  const task = getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    useSystemFonts: false,
    disableFontFace: true,
  });

  try {
    const document = await task.promise;
    if (document.numPages > 300) throw fail(413, 'PDF exceeds 300 pages');
    const pages = [];
    let size = 0;

    for (let page = 1; page <= document.numPages; page++) {
      const content = await (await document.getPage(page)).getTextContent();
      const text = content.items
        .map((item) => item.str + (item.hasEOL ? '\n' : ' '))
        .join('');

      size += text.length;
      if (size > 2_000_000)
        throw fail(413, 'Extracted text exceeds 2 million characters');

      pages.push({ page, text });
    }

    return pages;
  } catch (error) {
    if (error.statusCode) throw error;

    throw fail(
      422,
      'PDF could not be extracted. Encrypted or malformed PDFs are not supported.'
    );
  } finally {
    await task.destroy();
  }
}

export async function readArchive(buffer) {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(
      buffer,
      { lazyEntries: true, validateEntrySizes: true },
      (error, zip) => {
        if (error) return reject(fail(400, 'Invalid ZIP archive'));
        const files = [];
        let total = 0;
        let settled = false;

        const abort = (err) => {
          if (!settled) {
            settled = true;
            zip.close();
            reject(err);
          }
        };

        zip.on('error', () => abort(fail(400, 'Invalid ZIP archive')));
        zip.on('end', () => {
          if (!settled) {
            settled = true;
            resolve(files);
          }
        });
        zip.on('entry', (entry) => {
          if (
            entry.fileName.startsWith('__MACOSX/') ||
            !/\.(pdf|txt)$/i.test(entry.fileName)
          )
            return zip.readEntry();
          if (
            files.length >= 100 ||
            entry.uncompressedSize > 10 * 1024 * 1024 ||
            total + entry.uncompressedSize > 60 * 1024 * 1024
          )
            return abort(
              fail(413, 'Archive exceeds source limits (100 files / 60 MB)')
            );
          total += entry.uncompressedSize;
          zip.openReadStream(entry, (err, stream) => {
            if (err) return abort(fail(400, 'Cannot read ZIP member'));
            const chunks = [];
            let read = 0;
            stream.on('data', (chunk) => {
              read += chunk.length;
              if (read > entry.uncompressedSize) {
                stream.destroy();
                abort(fail(413, 'ZIP size mismatch'));
              } else chunks.push(chunk);
            });
            stream.on('error', () =>
              abort(fail(400, 'Cannot read ZIP member'))
            );
            stream.on('end', () => {
              if (!settled) {
                files.push({
                  name: entry.fileName,
                  buffer: Buffer.concat(chunks),
                });
                zip.readEntry();
              }
            });
          });
        });
        zip.readEntry();
      }
    );
  });
}

export async function ingestSource(
  userId,
  { name, buffer, sourceType, incomplete = false }
) {
  if (!SOURCE_TYPES.includes(sourceType))
    throw fail(400, 'Unknown source type');
  const format = path.extname(name).slice(1).toLowerCase();
  if (!['pdf', 'txt'].includes(format))
    throw fail(415, 'Upload PDF, TXT or ZIP files');
  const location = name.slice(0, 1000);
  const checksum = hash(buffer);
  const existing = await KnowledgeSource.findOne({
    userId,
    checksum,
    sourceType,
    location,
  });
  if (existing) return { source: existing, duplicate: true };
  const pages = await extractPages(buffer, format);
  const textChecksum = hash(
    pages.map((p) => p.text.replace(/\s+/g, ' ').trim()).join('\n')
  );
  const sameText = await KnowledgeSource.exists({ userId, textChecksum });
  const warnings = [
    'Extracted text requires review against the original; no knowledge has been approved.',
  ];
  if (sameText)
    warnings.push(
      'Duplicate text exists in another source occurrence; both locations are preserved.'
    );
  if (pages.some((p) => !p.text.trim()))
    warnings.push(
      'Some pages have no extractable text. Inspect the original for images or blank pages.'
    );
  const source = new KnowledgeSource({
    userId,
    title: path.basename(name),
    location,
    checksum,
    textChecksum,
    format,
    sourceType,
    incomplete: incomplete || sourceType === 'PRICE_ACTION_BONUS',
    warnings,
    sections: pages.map((p) => ({
      id: `page-${p.page}`,
      page: p.page,
      heading:
        p.text
          .split('\n')
          .find((s) => s.trim())
          ?.trim()
          .slice(0, 250) || `Page ${p.page}`,
      text: p.text,
    })),
  });
  const target = sourcePath(userId, source);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, buffer, { flag: 'wx', mode: 0o600 });
  try {
    await source.save();
  } catch (error) {
    await fs.unlink(target);
    throw error;
  }
  return { source, duplicate: false };
}
