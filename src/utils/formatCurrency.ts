export function formatMoney(amount: number, currency: string = 'VND', lang: 'en' | 'vi' = 'vi'): string {
  if (!amount && amount !== 0) return '0 ₫';

  if (lang === 'vi') {
    // If amount is small (e.g. previously configured in USD < 10000), convert to VND equivalent for realistic display
    let vndValue = amount;
    if (currency === 'USD' && amount < 10000) {
      vndValue = amount * 25000;
    }
    return `${Math.round(vndValue).toLocaleString('vi-VN')} ₫`;
  } else {
    // English mode
    if (currency === 'VND' || (currency !== 'USD' && amount > 10000)) {
      return `${Math.round(amount).toLocaleString('en-US')} VND`;
    }
    return `$${amount.toLocaleString('en-US')}`;
  }
}
