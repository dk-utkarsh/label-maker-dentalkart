import { put, list } from '@vercel/blob';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BLOB_PATH = 'variations/all.json';

async function getVariations(): Promise<unknown[]> {
  try {
    const { blobs } = await list({ prefix: 'variations/' });
    const blob = blobs.find(b => b.pathname === BLOB_PATH);
    if (!blob) return [];

    const fetchUrl = blob.downloadUrl || blob.url;
    const res = await fetch(`${fetchUrl}${fetchUrl.includes('?') ? '&' : '?'}t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    console.error('getVariations error:', e);
    return [];
  }
}

async function saveAllVariations(variations: unknown[]) {
  await put(BLOB_PATH, JSON.stringify(variations), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0,
  });
}

export async function GET() {
  const variations = await getVariations();
  return NextResponse.json(variations, {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  });
}

// Receives the FULL updated list from the client — no read-modify-write race
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const variations = Array.isArray(body) ? body : [];
    await saveAllVariations(variations);
    return NextResponse.json({ ok: true, count: variations.length }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    console.error('POST variations error:', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
