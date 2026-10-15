// ============================================
// Crypto utilities for API key storage
// Keys are obfuscated in localStorage (frontend-only demo)
// In production, use backend encryption (AES-256)
// ============================================

const ENCRYPTION_KEY = 'opennotebook-ai-v1-secret';

export function encryptKey(plaintext: string): string {
  if (!plaintext) return '';
  // Simple XOR-based obfuscation + base64 (NOT real encryption)
  // In production, this should be server-side AES-256
  let result = '';
  for (let i = 0; i < plaintext.length; i++) {
    const charCode = plaintext.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length);
    result += String.fromCharCode(charCode);
  }
  return btoa(result);
}

export function decryptKey(encrypted: string): string {
  if (!encrypted) return '';
  try {
    const decoded = atob(encrypted);
    let result = '';
    for (let i = 0; i < decoded.length; i++) {
      const charCode = decoded.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length);
      result += String.fromCharCode(charCode);
    }
    return result;
  } catch {
    return '';
  }
}

export function maskKey(key: string): string {
  if (!key || key.length < 8) return '••••••••';
  return key.substring(0, 4) + '••••••••' + key.substring(key.length - 4);
}
