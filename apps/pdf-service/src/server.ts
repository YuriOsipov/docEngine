import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import {
  generatePdfFromTemplate,
  generateHtmlFromTemplate,
  generateDocumentPdf,
} from '@docengine/pdf-renderer';

const PORT = Number(process.env.PORT ?? 3920);
const MAX_BODY_BYTES = Number(process.env.PDF_MAX_BODY_BYTES ?? 5 * 1024 * 1024);

async function readJsonBody(req: IncomingMessage): Promise<Record<string, any> | null> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buf.length;
    if (size > MAX_BODY_BYTES) {
      throw new Error(`Request body exceeds ${MAX_BODY_BYTES} bytes.`);
    }
    chunks.push(buf);
  }

  if (!chunks.length) return null;
  const raw = Buffer.concat(chunks).toString('utf8');
  return JSON.parse(raw) as Record<string, any>;
}

function sendJson(res: ServerResponse, status: number, payload: Record<string, unknown>): void {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/health') {
      sendJson(res, 200, { ok: true, service: 'pdf-service' });
      return;
    }

    const pathOnly = (req.url ?? '').split('?')[0];
    if (
      req.method === 'POST' &&
      (pathOnly === '/pdf/generate' || pathOnly === '/api/v1/render/pdf')
    ) {
      const body = await readJsonBody(req);
      if (!body) {
        sendJson(res, 400, { error: 'Request body is required.' });
        return;
      }

      let pdfBuffer: Buffer;

      // Full document snapshot (blocks + pageSetup) — Salesforce preview / filled export.
      const selfContainedDoc =
        (Array.isArray(body.doc?.blocks) && body.doc) ||
        (Array.isArray(body.document?.blocks) && body.document) ||
        null;

      if (selfContainedDoc) {
        pdfBuffer = await generateDocumentPdf(selfContainedDoc, {
          pageSetup: body.pageSetup ?? selfContainedDoc.pageSetup,
          fonts: body.fonts,
          fieldValueStyle: body.fieldValueStyle,
          fieldHighlight: body.fieldHighlight,
          hideEmptyValues: body.hideEmptyValues === true,
        });
      } else if (body.template && body.document) {
        pdfBuffer = await generatePdfFromTemplate({
          template: body.template,
          document: body.document,
          pageSetup: body.pageSetup,
          fonts: body.fonts,
          fieldValueStyle: body.fieldValueStyle,
          fieldHighlight: body.fieldHighlight,
          hideEmptyValues: body.hideEmptyValues === true,
        });
      } else {
        sendJson(res, 400, {
          error:
            'Request must include "template" + "document" (fields export), or a self-contained "doc" / "document" with blocks.',
        });
        return;
      }

      res.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Length': pdfBuffer.length,
        'Content-Disposition': 'inline; filename="document.pdf"',
      });
      res.end(pdfBuffer);
      return;
    }

    if (req.method === 'POST' && req.url === '/html/generate') {
      const body = await readJsonBody(req);
      if (!body?.template || !body?.document) {
        sendJson(res, 400, {
          error: 'Request must include "template" and "document" objects.',
        });
        return;
      }

      const html = await generateHtmlFromTemplate({
        template: body.template,
        document: body.document,
        pageSetup: body.pageSetup,
        fieldValueStyle: body.fieldValueStyle,
        fieldHighlight: body.fieldHighlight,
        fullDocument: body.fullDocument ?? true,
        cssOverride: body.cssOverride,
      });

      const buf = Buffer.from(html, 'utf8');
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Length': buf.length,
      });
      res.end(buf);
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    sendJson(res, 500, { error: message || 'PDF generation failed.' });
  }
});

server.listen(PORT, () => {
  console.log(`pdf-service listening on http://localhost:${PORT}`);
});
