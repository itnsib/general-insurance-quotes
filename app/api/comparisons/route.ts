import { NextResponse } from 'next/server';
import { listComparisons, writeComparison } from '../../lib/comparisons-store';
import type { SavedComparison } from '../../lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await listComparisons());
  } catch (error) {
    console.error('Failed to list comparisons:', error);
    return NextResponse.json({ error: 'Failed to load comparisons' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const comparison = (await request.json()) as SavedComparison;

    if (!comparison?.id || !comparison?.customerName) {
      return NextResponse.json({ error: 'id and customerName are required' }, { status: 400 });
    }

    return NextResponse.json(await writeComparison(comparison), { status: 201 });
  } catch (error) {
    console.error('Failed to save comparison:', error);
    return NextResponse.json({ error: 'Failed to save comparison' }, { status: 500 });
  }
}
