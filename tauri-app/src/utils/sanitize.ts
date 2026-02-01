/**
 * Escape HTML special characters to prevent XSS
 */
export function escapeHtml(unsafe: string): string {
  if (typeof unsafe !== 'string') return String(unsafe);
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Sanitize number for display
 */
export function sanitizeNumber(value: number, decimals = 2): string {
  if (typeof value !== 'number' || isNaN(value)) return '0.00';
  return value.toFixed(decimals);
}

/**
 * Validate and sanitize stock symbol
 */
export function sanitizeSymbol(symbol: string): string {
  if (typeof symbol !== 'string') return '';
  return symbol.toUpperCase().replace(/[^A-Z0-9.\-]/g, '').substring(0, 20);
}

/**
 * Validate API key format
 */
export function isValidApiKey(key: string, prefix: string): boolean {
  if (typeof key !== 'string') return false;
  return key.startsWith(prefix) && key.length >= 20;
}