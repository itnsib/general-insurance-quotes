// app/api/comparisons/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

interface SavedComparison {
  id: string;
  date: string;
  insuranceLine: string;
  customerName: string;
  quotes: any[];
  advisorComment?: string;
  referenceNumber: string;
  address?: string;
  businessActivity?: string;
  location?: string;
  propertyLimit?: string;
  enquiryNumber?: string;
}

const COMPARISONS_KEY = 'nsib:comparisons';

// GET - Load all comparisons
export async function GET() {
  try {
    const comparisons = await kv.get<SavedComparison[]>(COMPARISONS_KEY) || [];
    
    // Sort by date, newest first
    comparisons.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    return NextResponse.json({ 
      success: true, 
      comparisons,
      count: comparisons.length 
    });
  } catch (error) {
    console.error('GET /api/comparisons error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load comparisons' },
      { status: 500 }
    );
  }
}

// POST - Save new comparison
export async function POST(request: NextRequest) {
  try {
    const newComparison: SavedComparison = await request.json();
    
    // Validate required fields
    if (!newComparison.id || !newComparison.customerName || !newComparison.insuranceLine) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    const comparisons = await kv.get<SavedComparison[]>(COMPARISONS_KEY) || [];
    
    // Check if comparison already exists
    const existingIndex = comparisons.findIndex(c => c.id === newComparison.id);
    if (existingIndex !== -1) {
      return NextResponse.json(
        { success: false, error: 'Comparison already exists. Use PUT to update.' },
        { status: 409 }
      );
    }
    
    // Add new comparison
    comparisons.unshift(newComparison);
    await kv.set(COMPARISONS_KEY, comparisons);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Comparison saved successfully',
      comparison: newComparison 
    });
  } catch (error) {
    console.error('POST /api/comparisons error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save comparison' },
      { status: 500 }
    );
  }
}

// PUT - Update existing comparison
export async function PUT(request: NextRequest) {
  try {
    const updatedComparison: SavedComparison = await request.json();
    
    if (!updatedComparison.id) {
      return NextResponse.json(
        { success: false, error: 'ID is required for updates' },
        { status: 400 }
      );
    }
    
    const comparisons = await kv.get<SavedComparison[]>(COMPARISONS_KEY) || [];
    const existingIndex = comparisons.findIndex(c => c.id === updatedComparison.id);
    
    if (existingIndex === -1) {
      // If doesn't exist, create it
      comparisons.unshift(updatedComparison);
    } else {
      // Update existing
      comparisons[existingIndex] = updatedComparison;
    }
    
    await kv.set(COMPARISONS_KEY, comparisons);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Comparison updated successfully',
      comparison: updatedComparison 
    });
  } catch (error) {
    console.error('PUT /api/comparisons error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update comparison' },
      { status: 500 }
    );
  }
}

// DELETE - Remove comparison
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID is required for deletion' },
        { status: 400 }
      );
    }
    
    const comparisons = await kv.get<SavedComparison[]>(COMPARISONS_KEY) || [];
    const updatedComparisons = comparisons.filter(c => c.id !== id);
    
    if (comparisons.length === updatedComparisons.length) {
      return NextResponse.json(
        { success: false, error: 'Comparison not found' },
        { status: 404 }
      );
    }
    
    await kv.set(COMPARISONS_KEY, updatedComparisons);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Comparison deleted successfully',
      deletedId: id 
    });
  } catch (error) {
    console.error('DELETE /api/comparisons error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete comparison' },
      { status: 500 }
    );
  }
}
