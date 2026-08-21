// CamScanner 本地桥接服务（ADR 0009 / 0011）：分享链接→PDF、PDF→OCR。
// 用法：node scripts/camscanner-bridge.mjs [port]（默认 8787，仅监听 127.0.0.1）
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { downloadSharePdf } from './camscanner-share-lib.mjs';

const execFileAsync = promisify(execFile);

const PORT = Number(process.argv[2] || process.env.CS_BRIDGE_PORT || 8787);
const HOST = '127.0.0.1';

// camscanner 技能目录（含 camscanner-ocr.py 与 pylibs），可用环境变量覆盖。
const SKILL_DIR =
  process.env.CAMSCANNER_SKILL_DIR || join(homedir(), '.dsh', 'skills', 'camscanner-evidence-extract');
const OCR_SCRIPT = resolve(SKILL_DIR, 'scripts', 'camscanner-ocr.py');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Expose-Headers': 'X-Pdf-Filename',
};

function json(res, status, obj) {
  res.writeHead(status, { ...CORS, 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

async function readBodyBuffer(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

/** 用 camscanner-ocr.py 对 PDF 逐页 OCR，返回 [{ page, text }]。 */
async function ocrPdf(pdfBuffer) {
  const workdir = await mkdtemp(join(tmpdir(), 'pdf-orc-ocr-'));
  const pdfPath = join(workdir, 'input.pdf');
  const outdir = join(workdir, 'out');
  try {
    await writeFile(pdfPath, pdfBuffer);
    await execFileAsync('python3', [OCR_SCRIPT, pdfPath, outdir], { timeout: 600000 });
    const raw = JSON.parse(await readFile(join(outdir, 'ocr_result.json'), 'utf8'));
    return raw.map((p) => ({ page: p.page, text: (p.lines || []).join('\n') }));
  } finally {
    await rm(workdir, { recursive: true, force: true }).catch(() => {});
  }
}

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    json(res, 200, { ok: true, service: 'camscanner-bridge' });
    return;
  }

  if (req.method === 'POST' && req.url === '/import') {
    try {
      const body = await readBody(req);
      const { url } = JSON.parse(body || '{}');
      if (!url || typeof url !== 'string') {
        json(res, 400, { error: '缺少分享链接（body 应为 { "url": "..." }）' });
        return;
      }
      const { bytes, filename } = await downloadSharePdf(url);
      res.writeHead(200, {
        ...CORS,
        'Content-Type': 'application/pdf',
        'Content-Length': bytes.byteLength,
        'X-Pdf-Filename': encodeURIComponent(filename),
      });
      res.end(Buffer.from(bytes));
    } catch (err) {
      json(res, 500, { error: err instanceof Error ? err.message : String(err) });
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/ocr') {
    try {
      const buffer = await readBodyBuffer(req);
      if (buffer.length === 0) {
        json(res, 400, { error: '缺少 PDF 字节' });
        return;
      }
      const pages = await ocrPdf(buffer);
      json(res, 200, { pages });
    } catch (err) {
      json(res, 500, { error: err instanceof Error ? err.message : String(err) });
    }
    return;
  }

  json(res, 404, { error: '未知端点' });
});

server.listen(PORT, HOST, () => {
  console.log(`CamScanner 桥接服务已启动：http://${HOST}:${PORT}（仅本机）`);
  console.log('  POST /import  { "url": "分享链接" }   -> PDF 字节');
  console.log('  POST /ocr     (PDF 字节 body)         -> { pages: [{page, text}] }');
  console.log('  GET  /health                          -> 健康检查');
  console.log(`OCR 脚本：${OCR_SCRIPT}`);
});
