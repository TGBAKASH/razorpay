'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { API_BASE_URL } from '../../lib/config';
import { DealLifecycleNav } from '../../components/DealLifecycleNav';
import { TabularNumber } from '../../components/TabularNumber';

interface AuditLogEntry {
  id: string;
  offer_id: string;
  from_state: string | null;
  to_state: string;
  action: string;
  actor: string;
  input_data: Record<string, any>;
  policy_version: string;
  policy_checked: string;
  reason: string;
  razorpay_request?: any | null;
  razorpay_response?: any | null;
  timestamp: string;
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [filterOfferId, setFilterOfferId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [showTechnicalDetail, setShowTechnicalDetail] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, []);

  async function fetchLogs(targetOfferId?: string) {
    setIsLoading(true);
    try {
      const activeId = targetOfferId !== undefined ? targetOfferId : filterOfferId;
      const url = activeId
        ? `${API_BASE_URL}/api/audit-logs?offer_id=${encodeURIComponent(activeId)}`
        : `${API_BASE_URL}/api/audit-logs`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      } else {
        setLogs([]);
      }
    } catch {
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleFilterSubmit(e: React.FormEvent) {
    e.preventDefault();
    fetchLogs(filterOfferId);
  }

  const filteredLogs = logs.filter((log) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      log.action.toLowerCase().includes(q) ||
      log.actor.toLowerCase().includes(q) ||
      log.reason.toLowerCase().includes(q) ||
      log.offer_id.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#0A0D14] flex flex-col font-sans">
      <DealLifecycleNav currentStage="PAID" />

      <main className="max-w-6xl mx-auto px-4 py-8 flex-1 w-full space-y-6">
        {/* Header Explainer */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[#E3E8EF] pb-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-[#0C2340]">05 &bull; Audit Ledger</div>
            <h1 className="text-2xl font-bold text-[#0A0D14] tracking-tight">Cryptographic Event Ledger</h1>
            <p className="text-xs text-[#4A5568] mt-0.5">
              Append-only audit trail recording policy evaluations, signatures, and gateway events from PostgreSQL.
            </p>
          </div>
          <button
            onClick={() => fetchLogs()}
            disabled={isLoading}
            className="self-start md:self-auto px-3 py-1.5 border border-[#CDD5DF] rounded text-xs font-semibold hover:bg-white text-[#4A5568] transition"
          >
            {isLoading ? 'Fetching...' : '↺ Refresh Ledger'}
          </button>
        </div>

        {/* Filter Bar */}
        <div className="bg-white border border-[#E3E8EF] rounded-lg p-4 shadow-sm flex flex-col md:flex-row gap-4">
          <form onSubmit={handleFilterSubmit} className="flex-1 flex gap-2">
            <input
              type="text"
              placeholder="Filter by Offer ID (e.g. off-a1b2c3d4)..."
              value={filterOfferId}
              onChange={(e) => setFilterOfferId(e.target.value)}
              className="flex-1 text-xs border border-[#CDD5DF] rounded px-3 py-2 focus:outline-none focus:border-[#0C2340]"
            />
            <button
              type="submit"
              className="bg-[#0C2340] hover:bg-[#143258] text-white text-xs font-semibold px-4 py-2 rounded transition"
            >
              Filter
            </button>
            {filterOfferId && (
              <button
                type="button"
                onClick={() => {
                  setFilterOfferId('');
                  fetchLogs('');
                }}
                className="text-xs text-[#4A5568] hover:text-[#0A0D14] px-2 py-2"
              >
                Clear
              </button>
            )}
          </form>

          <div className="flex-1">
            <input
              type="text"
              placeholder="Search actions, reasons, or actors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs border border-[#CDD5DF] rounded px-3 py-2 focus:outline-none focus:border-[#0C2340]"
            />
          </div>
        </div>

        {/* Timeline Table */}
        <div className="bg-white border border-[#E3E8EF] rounded-lg shadow-sm overflow-hidden">
          {filteredLogs.length === 0 ? (
            <div className="p-12 text-center text-[#4A5568] space-y-3">
              <div className="text-3xl">📋</div>
              <div className="font-semibold text-sm text-[#0A0D14]">No audit log entries recorded yet</div>
              <p className="text-xs max-w-md mx-auto">
                Complete an offer negotiation on the Deal Room or make an order to generate immutable ledger entries.
              </p>
              <Link
                href="/deal-room"
                className="inline-block mt-2 bg-[#0C2340] text-white text-xs font-semibold px-4 py-2 rounded"
              >
                Go to Deal Room &rarr;
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#F8F9FA] border-b border-[#E3E8EF] text-[#4A5568] uppercase font-semibold text-[11px]">
                    <th className="py-2.5 px-4">Timestamp</th>
                    <th className="py-2.5 px-4">Offer ID</th>
                    <th className="py-2.5 px-4">Action</th>
                    <th className="py-2.5 px-4">Actor</th>
                    <th className="py-2.5 px-4">Policy Checked</th>
                    <th className="py-2.5 px-4">Result</th>
                    <th className="py-2.5 px-4 text-right">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3E8EF]">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-[#F8F9FA]/80 transition">
                      <td className="py-3 px-4 font-mono text-[11px] text-[#4A5568]">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-[#0C2340] font-semibold">
                        {log.offer_id ? log.offer_id.substring(0, 16) : '—'}
                      </td>
                      <td className="py-3 px-4 font-medium text-[#0A0D14]">{log.action}</td>
                      <td className="py-3 px-4 text-[#4A5568]">{log.actor}</td>
                      <td className="py-3 px-4 text-[#4A5568]">{log.policy_checked || 'State Machine Enforcer'}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                            log.to_state === 'FAILED' || log.action.includes('REJECT')
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {log.to_state === 'FAILED' || log.action.includes('REJECT') ? '✕ REJECTED' : '✓ VERIFIED'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="text-[#0C2340] hover:underline font-semibold text-[11px]"
                        >
                          Inspect &rarr;
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Selected Log Inspector Modal */}
        {selectedLog && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-white rounded-lg max-w-xl w-full p-6 shadow-xl border border-[#CDD5DF] space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-[#E3E8EF] pb-3">
                <div>
                  <div className="text-[10px] font-bold uppercase text-[#0C2340]">Audit Event Record</div>
                  <h3 className="text-base font-bold text-[#0A0D14]">{selectedLog.action}</h3>
                </div>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="text-gray-400 hover:text-gray-600 text-lg leading-none"
                >
                  &times;
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-[#4A5568] text-[10px]">Actor:</div>
                  <div className="font-semibold text-[#0A0D14] font-mono">{selectedLog.actor}</div>
                </div>
                <div>
                  <div className="text-[#4A5568] text-[10px]">Policy Version:</div>
                  <div className="font-semibold text-[#0A0D14]">{selectedLog.policy_version}</div>
                </div>
                <div>
                  <div className="text-[#4A5568] text-[10px]">Offer ID:</div>
                  <div className="font-semibold text-[#0C2340] font-mono">{selectedLog.offer_id || 'Global'}</div>
                </div>
                <div>
                  <div className="text-[#4A5568] text-[10px]">Timestamp:</div>
                  <div className="font-semibold text-[#0A0D14] font-mono">{selectedLog.timestamp}</div>
                </div>
              </div>

              <div className="bg-[#F8F9FA] p-3 rounded border border-[#E3E8EF] text-xs">
                <div className="text-[10px] font-bold uppercase text-[#4A5568] mb-1">Decision Rationale:</div>
                <p className="text-[#0A0D14] leading-relaxed">{selectedLog.reason}</p>
              </div>

              <div>
                <button
                  onClick={() => setShowTechnicalDetail(!showTechnicalDetail)}
                  className="text-[11px] text-[#0C2340] hover:underline font-semibold flex items-center gap-1"
                >
                  {showTechnicalDetail ? '▾ Hide raw cryptographic payload' : '▸ [ Show technical detail ]'}
                </button>

                {showTechnicalDetail && (
                  <pre className="mt-2 bg-[#0C2340] text-emerald-300 text-[11px] p-3 rounded overflow-x-auto font-mono max-h-48 leading-tight">
                    {JSON.stringify(
                      {
                        id: selectedLog.id,
                        input_data: selectedLog.input_data,
                        policy_checked: selectedLog.policy_checked,
                        razorpay_request: selectedLog.razorpay_request,
                        razorpay_response: selectedLog.razorpay_response,
                      },
                      null,
                      2
                    )}
                  </pre>
                )}
              </div>

              <div className="text-right pt-2 border-t border-[#E3E8EF]">
                <button
                  onClick={() => setSelectedLog(null)}
                  className="bg-[#0C2340] text-white text-xs font-semibold px-4 py-2 rounded"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
