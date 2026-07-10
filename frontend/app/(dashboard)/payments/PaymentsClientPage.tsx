'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminOnly, Alert, Badge, Button, PageHeader } from '@/components/ui';
import {
  Loader2,
  RefreshCw,
  Wallet,
  ArrowDownToLine,
  Receipt,
  BookOpen,
  GraduationCap,
  Clock3,
  Search,
  Inbox,
  Banknote,
} from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL;

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '';
}

type PayoutStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
type TxFilter = 'ALL' | 'FEE' | 'BOOK';

interface PayoutRequest {
  id: string;
  amountGhs: number;
  status: PayoutStatus;
  note: string | null;
  failureReason: string | null;
  createdAt: string;
  processedAt: string | null;
  requestedBy: { firstName: string; lastName: string };
}

interface Transaction {
  id: string;
  reference: string;
  type: 'FEE' | 'BOOK';
  schoolAmountGhs: number;
  paidAt: string;
  student: {
    studentId: string;
    firstName: string;
    lastName: string;
    class: { name: string } | null;
  };
  term: { name: string; year: number } | null;
}

interface Summary {
  availableBalanceGhs: number;
  totals: {
    feePayments: number;
    bookPayments: number;
    schoolCollectedGhs: number;
  };
  pendingPayoutsGhs: number;
  pendingPayoutCount: number;
  payouts: PayoutRequest[];
  payoutAlertsConfigured: boolean;
}

const PAYOUT_STATUS: Record<
  PayoutStatus,
  { label: string; variant: 'warning' | 'info' | 'success' | 'error' }
> = {
  PENDING: { label: 'Pending', variant: 'warning' },
  PROCESSING: { label: 'Processing', variant: 'info' },
  COMPLETED: { label: 'Completed', variant: 'success' },
  FAILED: { label: 'Failed', variant: 'error' },
};

function formatGhs(n: number) {
  return `GH₵${n.toFixed(2)}`;
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function formatShortDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: typeof Wallet;
  accent: 'primary' | 'success' | 'warning' | 'slate';
}) {
  const accents = {
    primary: 'bg-primary-50 text-primary-700 border-primary-100',
    success: 'bg-success-50 text-success-700 border-success-100',
    warning: 'bg-warning-50 text-warning-800 border-warning-100',
    slate: 'bg-gray-50 text-gray-700 border-gray-100',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
      <div
        className={`shrink-0 w-10 h-10 rounded-xl border flex items-center justify-center ${accents[accent]}`}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide truncate">
          {label}
        </p>
        <p className="text-xl font-bold text-gray-900 tabular-nums leading-tight">{value}</p>
        {sub && <p className="text-[11px] text-gray-400 mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  );
}

export default function PaymentsClientPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutNote, setPayoutNote] = useState('');
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutMessage, setPayoutMessage] = useState('');
  const [txFilter, setTxFilter] = useState<TxFilter>('ALL');
  const [txSearch, setTxSearch] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = getToken();
      const headers = { Authorization: `Bearer ${token}` };
      const [summaryRes, txRes] = await Promise.all([
        fetch(`${API}/payments/summary`, { headers }),
        fetch(`${API}/payments/transactions?limit=100`, { headers }),
      ]);
      if (!summaryRes.ok) throw new Error('Failed to load payments summary');
      if (!txRes.ok) throw new Error('Failed to load transactions');
      setSummary(await summaryRes.json());
      const txJson = await txRes.json();
      setTransactions(txJson.transactions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const requestPayout = async () => {
    const amount = parseFloat(payoutAmount);
    if (!Number.isFinite(amount) || amount < 1) {
      setPayoutMessage('Enter at least GH₵1.00 to request a payout.');
      return;
    }
    if (summary && amount > summary.availableBalanceGhs + 0.004) {
      setPayoutMessage('Amount exceeds available balance.');
      return;
    }

    setPayoutLoading(true);
    setPayoutMessage('');
    try {
      const token = getToken();
      const res = await fetch(`${API}/payments/payout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amountGhs: amount, note: payoutNote || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Payout request failed');

      setPayoutAmount('');
      setPayoutNote('');
      setPayoutMessage(data.message || 'Payout requested successfully.');
      await loadData();
    } catch (err) {
      setPayoutMessage(err instanceof Error ? err.message : 'Payout request failed');
    } finally {
      setPayoutLoading(false);
    }
  };

  const payoutMessageTone =
    /failed|exceeds|enter at least/i.test(payoutMessage) ? 'error' : 'success';

  const filteredTransactions = useMemo(() => {
    const q = txSearch.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (txFilter !== 'ALL' && tx.type !== txFilter) return false;
      if (!q) return true;
      const hay = [
        tx.student.firstName,
        tx.student.lastName,
        tx.student.studentId,
        tx.student.class?.name ?? '',
        tx.reference,
        tx.type === 'FEE' ? 'fees' : 'library',
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [transactions, txFilter, txSearch]);

  const canRequestPayout = !!summary && summary.availableBalanceGhs >= 1;

  return (
    <AdminOnly>
      <div className="space-y-6 px-4 py-4 sm:px-6 md:px-8 max-w-[1400px] mx-auto animate-fade-in min-h-full">
        <PageHeader
          title="Payments"
          subtitle="Track online fee and library collections, then request payouts."
          className="mb-0"
          actions={
            <Button variant="secondary" size="sm" onClick={() => void loadData()} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh
            </Button>
          }
        />

        {error && <Alert type="error" message={error} dismissible={false} />}

        {loading && !summary ? (
          <div className="flex items-center justify-center py-24 text-gray-500 gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading payments…
          </div>
        ) : summary ? (
          <>
            {/* Balance hero */}
            <section className="relative overflow-hidden rounded-2xl border border-primary-100 bg-white shadow-[var(--shadow-card)]">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary-50 via-white to-white pointer-events-none" />
              <div className="relative grid gap-6 p-5 sm:p-6 lg:grid-cols-[1.2fr_1fr] lg:items-end">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-primary-50 border border-primary-100 px-2.5 py-1 text-xs font-semibold text-primary-700 mb-3">
                    <Wallet className="h-3.5 w-3.5" />
                    Available for payout
                  </div>
                  <p className="text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-950 tabular-nums">
                    {formatGhs(summary.availableBalanceGhs)}
                  </p>
                  <p className="mt-2 text-sm text-gray-600 max-w-md">
                    Ready to transfer to your registered school account. Requested amounts are
                    deducted from this balance immediately.
                  </p>
                  {summary.pendingPayoutCount > 0 && (
                    <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5">
                      <Clock3 className="h-3.5 w-3.5" />
                      {summary.pendingPayoutCount} pending · {formatGhs(summary.pendingPayoutsGhs)}{' '}
                      in progress
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-gray-100 bg-white/80 p-3.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                      Total collected
                    </p>
                    <p className="mt-1 text-lg font-bold text-gray-900 tabular-nums">
                      {formatGhs(summary.totals.schoolCollectedGhs)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-gray-100 bg-white/80 p-3.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                      Online payments
                    </p>
                    <p className="mt-1 text-lg font-bold text-gray-900 tabular-nums">
                      {summary.totals.feePayments + summary.totals.bookPayments}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Stat strip */}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="School collected"
                value={formatGhs(summary.totals.schoolCollectedGhs)}
                sub="All successful online collections"
                icon={Banknote}
                accent="success"
              />
              <StatCard
                label="Fee payments"
                value={String(summary.totals.feePayments)}
                sub="School fees via payment provider"
                icon={GraduationCap}
                accent="primary"
              />
              <StatCard
                label="Library payments"
                value={String(summary.totals.bookPayments)}
                sub="Book purchases via payment provider"
                icon={BookOpen}
                accent="slate"
              />
              <StatCard
                label="Pending payouts"
                value={formatGhs(summary.pendingPayoutsGhs)}
                sub={
                  summary.pendingPayoutCount === 0
                    ? 'No requests waiting'
                    : `${summary.pendingPayoutCount} request${summary.pendingPayoutCount === 1 ? '' : 's'}`
                }
                icon={Clock3}
                accent={summary.pendingPayoutCount > 0 ? 'warning' : 'slate'}
              />
            </div>

            {/* Payout + history */}
            <div className="grid gap-5 lg:grid-cols-5">
              <section className="lg:col-span-2 rounded-2xl border border-gray-100 bg-white shadow-[var(--shadow-card)] p-5 sm:p-6">
                <div className="flex items-start gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-center shrink-0">
                    <ArrowDownToLine className="h-4 w-4 text-primary-700" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Request payout</h2>
                    <p className="text-sm text-gray-500 mt-0.5">
                      Transfer available balance to the school account.
                    </p>
                  </div>
                </div>

                {!summary.payoutAlertsConfigured && (
                  <div className="mb-4 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                    Payout alert SMS is not configured on the server. Contact support if you do not
                    receive confirmation.
                  </div>
                )}

                <div className="space-y-3.5">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-sm font-medium text-gray-700">Amount (GH₵)</label>
                      <button
                        type="button"
                        disabled={!canRequestPayout}
                        onClick={() =>
                          setPayoutAmount(summary.availableBalanceGhs.toFixed(2))
                        }
                        className="text-xs font-semibold text-primary-600 hover:text-primary-700 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Use full balance
                      </button>
                    </div>
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      value={payoutAmount}
                      onChange={(e) => setPayoutAmount(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-300 focus:bg-white transition"
                      placeholder="e.g. 500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Note <span className="font-normal text-gray-400">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={payoutNote}
                      onChange={(e) => setPayoutNote(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-300 focus:bg-white transition"
                      placeholder="e.g. Term 2 collections"
                    />
                  </div>

                  {payoutMessage && (
                    <p
                      className={`text-sm rounded-lg px-3 py-2 ${
                        payoutMessageTone === 'error'
                          ? 'bg-red-50 text-red-700 border border-red-100'
                          : 'bg-teal-50 text-teal-800 border border-teal-100'
                      }`}
                    >
                      {payoutMessage}
                    </p>
                  )}

                  <Button
                    className="w-full justify-center"
                    onClick={() => void requestPayout()}
                    disabled={payoutLoading || !canRequestPayout}
                  >
                    {payoutLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {canRequestPayout ? 'Request payout' : 'Insufficient balance'}
                  </Button>
                </div>
              </section>

              <section className="lg:col-span-3 rounded-2xl border border-gray-100 bg-white shadow-[var(--shadow-card)] p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Recent payout requests</h2>
                    <p className="text-sm text-gray-500">Latest transfers and their status</p>
                  </div>
                  {summary.payouts.length > 0 && (
                    <span className="text-xs font-semibold text-gray-500 bg-gray-50 border border-gray-100 rounded-full px-2.5 py-1">
                      {summary.payouts.length}
                    </span>
                  )}
                </div>

                {summary.payouts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                    <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center mb-3">
                      <Inbox className="h-5 w-5 text-gray-400" />
                    </div>
                    <p className="text-sm font-semibold text-gray-900">No payout requests yet</p>
                    <p className="text-xs text-gray-500 mt-1 max-w-xs">
                      When you request a payout, it will show up here with its processing status.
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-2.5 max-h-[22rem] overflow-y-auto pr-1">
                    {summary.payouts.map((p) => {
                      const st = PAYOUT_STATUS[p.status] ?? PAYOUT_STATUS.PENDING;
                      return (
                        <li
                          key={p.id}
                          className="rounded-xl border border-gray-100 bg-gray-50/40 px-4 py-3 flex items-start justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <p className="font-bold text-gray-900 tabular-nums">
                              {formatGhs(p.amountGhs)}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">{formatWhen(p.createdAt)}</p>
                            {p.note && (
                              <p className="text-xs text-gray-600 mt-1 truncate">{p.note}</p>
                            )}
                            {p.failureReason && (
                              <p className="text-xs text-red-600 mt-1">{p.failureReason}</p>
                            )}
                            <p className="text-[11px] text-gray-400 mt-1">
                              by {p.requestedBy.firstName} {p.requestedBy.lastName}
                            </p>
                          </div>
                          <Badge variant={st.variant}>{st.label}</Badge>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>

            {/* Transactions */}
            <section className="rounded-2xl border border-gray-100 bg-white shadow-[var(--shadow-card)] overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">All payments</h2>
                  <p className="text-sm text-gray-500">
                    Successful online fee and library payments
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="search"
                      value={txSearch}
                      onChange={(e) => setTxSearch(e.target.value)}
                      placeholder="Search student or reference…"
                      className="w-full sm:w-56 rounded-xl border border-gray-200 bg-gray-50/50 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-300 focus:bg-white"
                    />
                  </div>
                  <div className="inline-flex rounded-xl border border-gray-200 bg-gray-50 p-0.5">
                    {(
                      [
                        ['ALL', 'All'],
                        ['FEE', 'Fees'],
                        ['BOOK', 'Library'],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setTxFilter(value)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                          txFilter === value
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-gray-100">
                {filteredTransactions.length === 0 ? (
                  <div className="px-5 py-12 text-center">
                    <Receipt className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">
                      {transactions.length === 0
                        ? 'No online payments recorded yet.'
                        : 'No payments match your filters.'}
                    </p>
                  </div>
                ) : (
                  filteredTransactions.map((tx) => (
                    <div key={`${tx.type}-${tx.id}`} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 truncate">
                            {tx.student.firstName} {tx.student.lastName}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {tx.student.studentId}
                            {tx.student.class ? ` · ${tx.student.class.name}` : ''}
                          </p>
                        </div>
                        <p className="font-bold text-gray-900 tabular-nums shrink-0">
                          {formatGhs(tx.schoolAmountGhs)}
                        </p>
                      </div>
                      <div className="mt-2.5 flex items-center justify-between gap-2">
                        <Badge variant={tx.type === 'FEE' ? 'info' : 'default'}>
                          {tx.type === 'FEE' ? 'Fees' : 'Library'}
                        </Badge>
                        <p className="text-[11px] text-gray-400">{formatShortDate(tx.paidAt)}</p>
                      </div>
                      <p className="mt-1.5 font-mono text-[10px] text-gray-400 truncate">
                        {tx.reference}
                      </p>
                    </div>
                  ))
                )}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50/80 text-left text-gray-500">
                    <tr>
                      <th className="px-5 py-3 font-semibold text-xs uppercase tracking-wide">
                        When
                      </th>
                      <th className="px-5 py-3 font-semibold text-xs uppercase tracking-wide">
                        Student
                      </th>
                      <th className="px-5 py-3 font-semibold text-xs uppercase tracking-wide">
                        Type
                      </th>
                      <th className="px-5 py-3 font-semibold text-xs uppercase tracking-wide">
                        Amount
                      </th>
                      <th className="px-5 py-3 font-semibold text-xs uppercase tracking-wide">
                        Reference
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-14 text-center text-gray-500">
                          <Receipt className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                          {transactions.length === 0
                            ? 'No online payments recorded yet.'
                            : 'No payments match your filters.'}
                        </td>
                      </tr>
                    ) : (
                      filteredTransactions.map((tx) => (
                        <tr
                          key={`${tx.type}-${tx.id}`}
                          className="border-t border-gray-100 hover:bg-gray-50/60 transition-colors"
                        >
                          <td className="px-5 py-3.5 whitespace-nowrap text-gray-600">
                            {formatWhen(tx.paidAt)}
                          </td>
                          <td className="px-5 py-3.5">
                            <p className="font-medium text-gray-900">
                              {tx.student.firstName} {tx.student.lastName}
                            </p>
                            <p className="text-xs text-gray-500">
                              {tx.student.studentId}
                              {tx.student.class ? ` · ${tx.student.class.name}` : ''}
                            </p>
                          </td>
                          <td className="px-5 py-3.5">
                            <Badge variant={tx.type === 'FEE' ? 'info' : 'default'}>
                              {tx.type === 'FEE' ? 'Fees' : 'Library'}
                            </Badge>
                          </td>
                          <td className="px-5 py-3.5 font-semibold text-gray-900 tabular-nums">
                            {formatGhs(tx.schoolAmountGhs)}
                          </td>
                          <td className="px-5 py-3.5 font-mono text-xs text-gray-500">
                            {tx.reference}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </AdminOnly>
  );
}
