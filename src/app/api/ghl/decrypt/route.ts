import { NextRequest, NextResponse } from 'next/server';
import CryptoJS from 'crypto-js';
import { config } from '@/lib/config';
import { mintSessionToken } from '@/lib/session';

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

    // Mint a signed session bound to this location. This is the only point where
    // GHL-issued authenticity is proven, so it's where we establish trust. The
    // browser stores the token and sends it as Authorization: Bearer on API calls.
    let sessionToken: string | null = null;
    if (userData?.activeLocation) {
      sessionToken = mintSessionToken({
        uid: userData.userId,
        loc: userData.activeLocation,
        cid: userData.companyId,
        role: userData.role,
      });
    }

    return NextResponse.json({ ...userData, sessionToken });
  } catch (error) {
    console.error('Error decrypting GHL user data:', error);
    return NextResponse.json(
      { error: 'Failed to decrypt user data' },
      { status: 500 }
    );
  }
}
