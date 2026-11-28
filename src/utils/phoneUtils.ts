export function normalizePhoneNumber(phone: string): string {
  return (phone || '').replace(/[\s\-().]/g, '').trim();
}
