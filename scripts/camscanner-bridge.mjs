// CamScanner 本地桥接服务：把「分享链接 → PDF」能力暴露给浏览器前端（ADR 0009）
// 用法：node scripts/camscanner-bridge.mjs [port]（默认 8787，仅监听 127.0.0.1）
import { createServer } from 'node:http';
import { downloadSharePdf } from './camscanner-share-lib.mjs';

const PORT = Number(process.argv[2] || process.env.CS_BRIDGE_PORT || 8787);
const HOST = '127.0.0.1';

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

const server = createServer(async (req, res) => {
  // CORS 预检
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

  json(res, 404, { error: '未知端点' });
});

server.listen(PORT, HOST, () => {
  console.log(`CamScanner 桥接服务已启动：http://${HOST}:${PORT}（仅本机）`);
  console.log('  POST /import  { "url": "分享链接" }   -> PDF 字节');
  console.log('  GET  /health                          -> 健康检查');
});
