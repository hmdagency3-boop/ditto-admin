export async function generateDeviceFingerprint(): Promise<string> {
  const components: string[] = [];
  
  components.push(navigator.userAgent);
  components.push(navigator.language);
  components.push(screen.width + 'x' + screen.height);
  components.push(screen.colorDepth.toString());
  components.push(new Date().getTimezoneOffset().toString());
  components.push(navigator.hardwareConcurrency?.toString() || 'unknown');
  components.push(navigator.platform || 'unknown');
  
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('fingerprint', 2, 2);
      components.push(canvas.toDataURL());
    }
  } catch (e) {
    components.push('canvas-error');
  }

  const fingerprint = components.join('|||');
  
  const encoder = new TextEncoder();
  const data = encoder.encode(fingerprint);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex;
}

export function getStoredPendingRequest(): { username: string; fingerprint: string } | null {
  try {
    const stored = localStorage.getItem('pending_registration');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Error reading pending registration:', e);
  }
  return null;
}

export function storePendingRequest(username: string, fingerprint: string): void {
  try {
    localStorage.setItem('pending_registration', JSON.stringify({ username, fingerprint }));
  } catch (e) {
    console.error('Error storing pending registration:', e);
  }
}

export function clearPendingRequest(): void {
  try {
    localStorage.removeItem('pending_registration');
  } catch (e) {
    console.error('Error clearing pending registration:', e);
  }
}
