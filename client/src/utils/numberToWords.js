export const numberToWords = (num) => {
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const inWords = (n) => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? ' ' + a[n % 10] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + inWords(n % 100) : '');
    if (n < 100000) return inWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + inWords(n % 1000) : '');
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + inWords(n % 100000) : '');
    return inWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + inWords(n % 10000000) : '');
  };

  const rupees = Math.floor(num);
  const paise = Math.round((num - rupees) * 100);
  let result = rupees ? inWords(rupees) + ' Rupees' : '';
  if (paise) result += (result ? ' and ' : '') + inWords(paise) + ' Paise';
  return result ? result + ' Only' : 'Zero Rupees Only';
};

// Auto-increment invoice number
export const generateInvoiceNumber = () => {
  const year = new Date().getFullYear();
  const counterKey = `invoiceCounter_${year}`;
  const current = parseInt(localStorage.getItem(counterKey) || '0', 10);
  const next = current + 1;
  localStorage.setItem(counterKey, next.toString());
  return `INV-${year}-${String(next).padStart(3, '0')}`;
};

// Storage helpers
export const INVOICE_HISTORY_KEY = 'invoiceHistory';

export const saveInvoiceToHistory = (invoice) => {
  try {
    const history = JSON.parse(localStorage.getItem(INVOICE_HISTORY_KEY) || '[]');
    history.unshift({
      ...invoice,
      savedAt: new Date().toISOString(),
      id: `inv_${Date.now()}`,
    });
    // keep last 100
    localStorage.setItem(INVOICE_HISTORY_KEY, JSON.stringify(history.slice(0, 100)));
  } catch (e) {
    console.error('Save history failed', e);
  }
};

export const getInvoiceHistory = () => {
  try {
    return JSON.parse(localStorage.getItem(INVOICE_HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
};

export const clearInvoiceHistory = () => {
  localStorage.removeItem(INVOICE_HISTORY_KEY);
};

export const deleteInvoiceFromHistory = (id) => {
  const history = getInvoiceHistory().filter((inv) => inv.id !== id);
  localStorage.setItem(INVOICE_HISTORY_KEY, JSON.stringify(history));
};