import {getAdminAccess} from '@/lib/auth';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

// Local renderer resources only; no uploaded document ever reaches this handler.
export async function GET(_request: Request, { params }: { params: Promise<{ asset: string[] }> }) {
  if ((await getAdminAccess()).status !== 'admin') return new Response(null, { status: 403 });
  const { asset } = await params;
  if (asset.length !== 2) return new Response(null, { status: 404 });
  const [directory, file] = asset;
  const allowed = /^[A-Za-z0-9_.-]+$/.test(file) && (
    (directory === 'build' && file === 'pdf.worker.min.mjs') ||
    (directory === 'cmaps' && file.endsWith('.bcmap')) ||
    (directory === 'standard_fonts' && /\.(pfb|ttf)$/.test(file)) ||
    (directory === 'wasm' && /\.(wasm|js)$/.test(file) && !file.startsWith('quickjs'))
  );
  if (!allowed) return new Response(null, { status: 404 });
  try {
    const bytes = await readFile(path.join(process.cwd(), 'node_modules/pdfjs-dist', directory, file));
    const type = /\.(mjs|js)$/.test(file) ? 'text/javascript' : file.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream';
    return new Response(bytes, { headers: { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch { return new Response(null, { status: 404 }); }
}
