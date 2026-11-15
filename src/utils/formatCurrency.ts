export function formatMoney(amount: number, currency: string = 'VND', lang: 'en' | 'vi' = 'vi'): string {
  const num = Number(amount) || 0;
  const curr = (currency || 'VND').toUpperCase();

  if (curr === 'VND') {
    return `${Math.round(num).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US')} ₫`;
  }
  if (curr === 'USD') {
    return `$${num.toLocaleString('en-US', { minimumFractionDigits: num % 1 !== 0 ? 2 : 0, maximumFractionDigits: 2 })}`;
  }
  if (curr === 'EUR') {
    return `€${num.toLocaleString('en-US')}`;
  }
  if (curr === 'JPY') {
    return `¥${Math.round(num).toLocaleString('en-US')}`;
  }
  return `${num.toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US')} ${curr}`;
}
