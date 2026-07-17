import { NextResponse } from 'next/server';
import { deleteComparison, readComparison, writeComparison } from '../../../lib/comparisons-store';
import type { SavedComparison } from '../../../lib/types';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const comparison = await readComparison(id);

    if (!comparison) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(comparison);
  } catch (error) {
    console.error('Failed to read comparison:', error);
    return NextResponse.json({ error: 'Failed to read comparison' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const comparison = (await request.json()) as SavedComparison;

    // The blob pathname is derived from the id, so a mismatched body id would
    // write to a different record than the URL addresses.
    return NextResponse.json(await writeComparison({ ...comparison, id }));
  } catch (error) {
    console.error('Failed to update comparison:', error);
    return NextResponse.json({ error: 'Failed to update comparison' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  try {
    const { id } = await params;
    await deleteComparison(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Failed to delete comparison:', error);
    return NextResponse.json({ error: 'Failed to delete comparison' }, { status: 500 });
  }
}
