import { put, list, del } from '@vercel/blob';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BLOB_PATH = 'variations/all.json';

async function getVariations() {
  try {
    const { blobs } = await list({ prefix: 'variations/' });
    const blob = blobs.find(b => b.pathname === BLOB_PATH);
    if (!blob) return [];
    const res = await fetch(blob.url);
    return await res.json();
  } catch {
    return [];
  }
}

async function saveVariations(variations: unknown[]) {
  const blob = await put(BLOB_PATH, JSON.stringify(variations), {
    access: 'public',
    addRandomSuffix: false,
  });
  return blob;
}

export async function GET() {
  const variations = await getVariations();
  return NextResponse.json(variations);
}

export async function POST(req: Request) {
  const variation = await req.json();
  const existing = await getVariations();
  const updated = [...existing, variation];
  await saveVariations(updated);
  return NextResponse.json(variation);
}

export async function DELETE(req: Request) {
  const { id } = await req.json();
  const existing = await getVariations();
  const updated = existing.filter((v: { id: string }) => v.id !== id);
  await saveVariations(updated);
  return NextResponse.json({ ok: true });
}
