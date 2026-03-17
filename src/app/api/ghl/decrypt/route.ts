import { NextRequest, NextResponse } from 'next/server';
import CryptoJS from 'crypto-js';
import { config } from '@/lib/config';

const GHL_SSO_KEY = config.ghl.ssoKey;

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    const decryptedBytes = CryptoJS.AES.decrypt(token, GHL_SSO_KEY);
    const plaintext = decryptedBytes.toString(CryptoJS.enc.Utf8);

    if (!plaintext) {
      return NextResponse.json(
        { error: 'Failed to decrypt token - invalid key or token' },
        { status: 400 }
      );
    }

    const userData = JSON.parse(plaintext);

    return NextResponse.json(userData);
  } catch (error) {
    console.error('Error decrypting GHL user data:', error);
    return NextResponse.json(
      { error: 'Failed to decrypt user data' },
      { status: 500 }
    );
  }
}
