/**
 * Secure cryptographic helper functions using standard Web Crypto API.
 */

export async function hashStringSHA256(text: string, salt: string = 'tripmate_sec_salt'): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${salt}:${text}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
