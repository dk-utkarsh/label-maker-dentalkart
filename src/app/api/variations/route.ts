import { put, head, list } from '@vercel/blob';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BLOB_PATH = 'variations/all.json';

async function getVariations(): Promise<unknown[]> {
  try {
    // List all blobs and find the latest one matching our path
    const { blobs } = await list({ prefix: 'variations/' });
    const blob = blobs.find(b => b.pathname === BLOB_PATH);
    if (!blob) return [];

    // Use downloadUrl (not url) to bypass CDN cache
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

async function saveVariations(variations: unknown[]) {
  const blob = await put(BLOB_PATH, JSON.stringify(variations), {
    access: 'public',
    addRandomSuffix: false,
    cacheControlMaxAge: 0,
  });
  return blob;
}

export async function GET() {
  const variations = await getVariations();
  return NextResponse.json(variations, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}

export async function POST(req: Request) {
  try {
    const variation = await req.json();
    const existing = await getVariations();
    const updated = [...existing, variation];
    await saveVariations(updated);
    return NextResponse.json({ ok: true, count: updated.length }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    console.error('POST variations error:', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    const existing = await getVariations();
    const updated = existing.filter((v: any) => v.id !== id);
    await saveVariations(updated);
    return NextResponse.json({ ok: true }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    console.error('DELETE variations error:', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
