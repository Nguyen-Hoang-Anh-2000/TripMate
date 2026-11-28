export function normalizePhoneNumber(phone: string): string {
  const stripped = (phone || '').replace(/[\s\-\u2013\u2014()._]/g, '').trim();
  return stripped.replace(/^(?:\+84|84)(?=\d{9}$)/, '0');
}
