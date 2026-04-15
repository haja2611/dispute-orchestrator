import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { fetchDisputes } from '../api/disputeApi.js'

const STATUS_OPTIONS = [
  '', 'PENDING_REVIEW', 'APPROVED', 'REJECTED',
  'REFUND_INITIATED', 'REFUNDED', 'CLOSED',
]

function statusBadge(status) {
  const map = {
    PENDING_REVIEW:   'badge-pending',
    APPROVED:         'badge-approved',
    REJECTED:         'badge-rejected',
    REFUNDED:         'badge-refunded',
    REFUND_INITIATED: 'badge-initiated',
    CLOSED:           'badge-closed',
  }
  return <span className={map[status] || 'badge'}>{status?.replace('_', ' ')}</span>
}

function routingPill(routing) {
  return routing === 'AUTO'
    ? <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-900/50 text-emerald-400 border border-emerald-800/50 font-medium">AUTO</span>
    : <span className="text-xs px-2 py-0.5 rounded-full bg-amber-900/50  text-amber-400  border border-amber-800/50  font-medium">MANUAL</span>
}

function formatDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function DisputeList() {
  const navigate = useNavigate()
  const [custId,  setCustId]  = useState('')
  const [status,  setStatus]  = useState('')

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['disputes', custId, status],
    queryFn:  () => fetchDisputes({ custId: custId || undefined, status: status || undefined }),
  })

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="gradient-text mb-1">Dispute Management</h1>
          <p className="text-gray-500 text-sm">
            {data ? `${data.length} dispute${data.length !== 1 ? 's' : ''}` : 'Loading…'}
          </p>
        </div>
        <button id="newDisputeBtn" className="btn-primary" onClick={() => navigate('/create')}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Dispute
        </button>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="card-body">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[140px]">
              <label className="form-label">Customer ID</label>
              <input id="filterCustId" type="number" min="1" className="form-input"
                placeholder="All customers" value={custId}
                onChange={(e) => setCustId(e.target.value)} />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="form-label">Status</label>
              <select id="filterStatus" className="form-select"
                value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s || '— All statuses —'}</option>
                ))}
              </select>
            </div>
            <button className="btn-ghost" onClick={() => { setCustId(''); setStatus('') }}>
              Clear
            </button>
            <button className="btn-primary" onClick={() => refetch()}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* State: loading */}
      {isLoading && (
        <div className="card">
          <div className="card-body flex items-center justify-center py-16">
            <span className="spinner w-6 h-6 border-brand-500 mr-3" />
            <span className="text-gray-500">Loading disputes…</span>
          </div>
        </div>
      )}

      {/* State: error */}
      {isError && (
        <div className="card border-red-800/50">
          <div className="card-body text-center py-10">
            <p className="text-red-400 font-medium mb-2">Failed to load disputes</p>
            <p className="text-gray-500 text-sm">{error?.message}</p>
            <button className="btn-ghost mt-4" onClick={() => refetch()}>Retry</button>
          </div>
        </div>
      )}

      {/* State: empty */}
      {!isLoading && !isError && data?.length === 0 && (
        <div className="card">
          <div className="card-body text-center py-16">
            <div className="w-14 h-14 rounded-full bg-gray-800 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-gray-400 font-medium">No disputes found</p>
            <p className="text-gray-600 text-sm mt-1">Try adjusting filters or create a new dispute</p>
          </div>
        </div>
      )}

      {/* Table */}
      {!isLoading && !isError && data?.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Merchant</th>
                  <th>Txn Amt (₹)</th>
                  <th>Claim (₹)</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Route</th>
                  <th>Risk</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {data.map((d) => (
                  <tr key={d.DISPUTE_ID} onClick={() => navigate(`/disputes/${d.DISPUTE_ID}`)}>
                    <td className="font-mono text-brand-400 font-semibold">#{d.DISPUTE_ID}</td>
                    <td className="font-medium text-gray-200">{d.MERCHANT_NAME || '—'}</td>
                    <td>₹{Number(d.TXN_AMOUNT).toLocaleString('en-IN')}</td>
                    <td className="font-semibold">₹{Number(d.CLAIM_AMOUNT).toLocaleString('en-IN')}</td>
                    <td>
                      <span className="text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded-md">
                        {d.DISPUTE_TYPE?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td>{statusBadge(d.DISPUTE_STATUS)}</td>
                    <td>{routingPill(d.ROUTING)}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="risk-bar-track w-16">
                          <div
                            className={`risk-bar-fill ${
                              d.RISK_SCORE > 70 ? 'bg-red-500' :
                              d.RISK_SCORE > 40 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${d.RISK_SCORE}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">{d.RISK_SCORE}</span>
                      </div>
                    </td>
                    <td className="text-gray-500 text-xs">{formatDate(d.CREATED_AT)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
