interface UserDataResponse {
  message: string;
  payload: string;
}

export interface GHLUserData {
  userId: string;
  companyId: string;
  activeLocation: string;
  role: string;
  type: string;
  userName: string;
  email: string;
  isAgencyOwner: boolean;
  versionId?: string;
  appStatus?: string;
  whitelabelDetails?: {
    domain: string;
    logoUrl: string;
  };
}

/**
 * Requests encrypted user data from GHL parent window via postMessage.
 * Only works when the page is embedded as a GHL custom page (iframe).
 */
export function requestUserData(): Promise<string> {
  return new Promise((resolve, reject) => {
    // Check if we're in an iframe
    if (window === window.parent) {
      reject(new Error('Not embedded in GHL iframe'));
      return;
    }

    function messageHandler(event: MessageEvent<UserDataResponse>) {
      if (event.data?.message === 'REQUEST_USER_DATA_RESPONSE') {
        window.removeEventListener('message', messageHandler);
        resolve(event.data.payload);
      }
    }

    window.addEventListener('message', messageHandler);
    window.parent.postMessage({ message: 'REQUEST_USER_DATA' }, '*');

    setTimeout(() => {
      window.removeEventListener('message', messageHandler);
      reject(new Error('Timeout waiting for GHL user data response'));
    }, 10000);
  });
}

/**
 * Gets the decrypted GHL user data by:
 * 1. Requesting encrypted token from GHL parent window
 * 2. Sending it to our backend for decryption
 */
export async function getGHLUserData(): Promise<GHLUserData> {
  const encryptedToken = await requestUserData();

  const response = await fetch('/api/ghl/decrypt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: encryptedToken }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to decrypt user data');
  }

  return response.json();
}
