import { NextRequest, NextResponse } from 'next/server';
import { difyClient } from '@/lib/dify';

export async function GET() {
  try {
    const datasets = await difyClient.listDatasets();
    return NextResponse.json(datasets);
  } catch (error) {
    console.error('Dify API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch datasets from Dify' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.name) {
      return NextResponse.json(
        { error: 'Dataset name is required' },
        { status: 400 }
      );
    }

    const dataset = await difyClient.createDataset(body.name, body.description);
    return NextResponse.json(dataset, { status: 201 });
  } catch (error) {
    console.error('Dify API error:', error);
    return NextResponse.json(
      { error: 'Failed to create dataset in Dify' },
      { status: 500 }
    );
  }
}

