import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import { API } from '../constants/api';

export type Receipt = {
  receiptNo: string;
  date: string;
  name: string;
  flatNumber?: string;
  amount: number;
  fund: string;
  status: string;
  society: string;
  societyCode?: string;
};

const PRIMARY = '#A72608';

function receiptHtml(r: Receipt): string {
  const dt = r.date ? new Date(r.date) : new Date();
  const dateStr = dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr = dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const amount = `₹${Number(r.amount || 0).toLocaleString('en-IN')}`;
  const paid = String(r.status).toLowerCase() === 'paid';

  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif; color: #1c100d; margin: 0; padding: 32px; }
    .card { border: 1px solid #eee; border-radius: 16px; overflow: hidden; max-width: 640px; margin: 0 auto; }
    .head { background: ${PRIMARY}; color: #fff; padding: 28px 32px; }
    .society { font-size: 22px; font-weight: 800; }
    .sub { font-size: 12px; opacity: 0.85; letter-spacing: 1px; margin-top: 4px; text-transform: uppercase; }
    .body { padding: 28px 32px; }
    .title { font-size: 13px; letter-spacing: 2px; color: #999; text-transform: uppercase; }
    .amount { font-size: 42px; font-weight: 900; margin: 6px 0 2px; }
    .badge { display: inline-block; padding: 5px 12px; border-radius: 999px; font-size: 12px; font-weight: 800;
             background: ${paid ? '#e6f4eb' : '#fdecec'}; color: ${paid ? '#1d7a3a' : PRIMARY}; }
    table { width: 100%; border-collapse: collapse; margin-top: 22px; }
    td { padding: 12px 0; border-bottom: 1px solid #f2efed; font-size: 15px; }
    td.k { color: #888; width: 45%; }
    td.v { text-align: right; font-weight: 700; }
    .foot { padding: 18px 32px; background: #faf8f7; font-size: 11px; color: #999; text-align: center; }
  </style></head>
  <body>
    <div class="card">
      <div class="head">
        <div class="society">${escapeHtml(r.society)}</div>
        <div class="sub">Payment Receipt${r.societyCode ? ' · Code ' + escapeHtml(r.societyCode) : ''}</div>
      </div>
      <div class="body">
        <div class="title">Amount Received</div>
        <div class="amount">${amount}</div>
        <span class="badge">${paid ? 'PAID' : 'PENDING'}</span>
        <table>
          <tr><td class="k">Receipt No.</td><td class="v">${escapeHtml(r.receiptNo)}</td></tr>
          <tr><td class="k">Date</td><td class="v">${dateStr}, ${timeStr}</td></tr>
          <tr><td class="k">Received From</td><td class="v">${escapeHtml(r.name)}${r.flatNumber ? ' · Flat ' + escapeHtml(r.flatNumber) : ''}</td></tr>
          <tr><td class="k">Towards</td><td class="v">${escapeHtml(r.fund)}</td></tr>
        </table>
      </div>
      <div class="foot">This is a system-generated receipt from Grihive. No signature required.</div>
    </div>
  </body></html>`;
}

function escapeHtml(s: any): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

/** Fetch a contribution's receipt, render it to a PDF, and open the share sheet. */
export async function shareContributionReceipt(contributionId: string, token: string): Promise<void> {
  try {
    const res = await fetch(API.CONTRIBUTION_RECEIPT(contributionId), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    if (!res.ok || !json.data) throw new Error(json.message || 'Could not load the receipt');

    const { uri } = await Print.printToFileAsync({ html: receiptHtml(json.data as Receipt) });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Contribution receipt', UTI: 'com.adobe.pdf' });
    } else {
      Alert.alert('Receipt saved', `Saved to: ${uri}`);
    }
  } catch (err: any) {
    Alert.alert('Error', err.message || 'Could not generate the receipt');
  }
}
