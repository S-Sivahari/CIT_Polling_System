import { NextRequest, NextResponse } from 'next/server';

const LEETCODE_URL = 'https://leetcode.com/graphql';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Content-Type': 'application/json',
  'Referer': 'https://leetcode.com'
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const response = await fetch(LEETCODE_URL, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `LeetCode API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('LeetCode API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch LeetCode data' },
      { status: 500 }
    );
  }
}
