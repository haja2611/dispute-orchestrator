import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { fetchDisputeById, decideDispute, refundDispute } from '../api/disputeApi.js'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function currency(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
}

function StatusBadge({ status }) {
  const map = {
    PENDING_REVIEW:   'badge-pending',
    APPROVED:         'badge-approved',
    REJECTED:         'badge-rejected',
    REFUNDED:         'badge-refunded',
    REFUND_INITIATED: 'badge-initiated',
    CLOSED:           'badge-closed',
  }
  return <span className={map[status] || 'badge'}>{status?.replace(/_/g, ' ')}</span>
}

function RiskMeter({ score }) {
  const color  = score > 70 ? '#ef4444' : score > 40 ? '#f59e0b' : '#10b981'
  const label  = score > 70 ? 'High' : score > 40 ? 'Medium' : 'Low'
  const txtCls = score > 70 ? 'text-red-400' : score > 40 ? 'text-amber-400' : 'text-emerald-400'
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-xs text-gray-500">Risk Score</span>
        <span className={`text-sm font-bold ${txtCls}`}>{score}/100 — {label}</span>
      </div>
      <div className="risk-bar-track">
        <div className="risk-bar-fill" style={{ width: `${score}%`, background: color }} />
      </div>
    </div>
  )
}

function EventDot({ type }) {
  const map = {
    DISPUTE_CREATED:      { bg: 'bg-brand-600',   icon: '✦' },
    DISPUTE_APPROVED:     { bg: 'bg-emerald-600',  icon: '✓' },
    DISPUTE_REJECTED:     { bg: 'bg-red-600',      icon: '✕' },
    SENT_TO_MANUAL_REVIEW:{ bg: 'bg-amber-600',    icon: '⟳' },
    REFUND_INITIATED:     { bg: 'bg-purple-600',   icon: '↑' },
    REFUNDED:             { bg: 'bg-blue-600',      icon: '✓' },
  }
  const { bg, icon } = map[type] || { bg: 'bg-gray-600', icon: '•' }
  return (
    <div className={`timeline-dot ${bg} text-white text-xs`}>{icon}</div>
  )
}

// ─── Action buttons ───────────────────────────────────────────────────────────

function ActionPanel({ dispute, onDecide, onRefund, deciding, refunding }) {
  const [notes, setNotes]   = useState('')
  const [actor, setActor]   = useState('agent-001')
  const status = dispute.DISPUTE_STATUS

  const canDecide  = status === 'PENDING_REVIEW'
  const canRefund  = status === 'APPROVED'
  const isTerminal = ['REJECTED','REFUNDED','CLOSED'].includes(status)

  if (isTerminal) {
    return (
      <div className="glass p-4 text-center text-sm text-gray-500">
        Dispute is in terminal state — no further actions available.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="form-label">Actor / Agent</label>
        <input type="text" className="form-input" value={actor}
          onChange={(e) => setActor(e.target.value)} placeholder="agent-id" />
      </div>

      {canDecide && (
        <div>
          <label className="form-label">Decision Notes</label>
          <textarea className="form-input min-h-[70px]" value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes for audit trail" />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {canDecide && (
          <>
            <button id="btnApprove" className="btn-success" disabled={deciding || refunding}
              onClick={() => onDecide({ decision: 'APPROVE', actor, notes })}>
              {deciding === 'APPROVE' ? <><span className="spinner" /> Approving…</> : '✓ Approve'}
            </button>
            <button id="btnReject" className="btn-danger" disabled={deciding || refunding}
              onClick={() => onDecide({ decision: 'REJECT', actor, notes })}>
              {deciding === 'REJECT' ? <><span className="spinner" /> Rejecting…</> : '✕ Reject'}
            </button>
            <button id="btnManual" className="btn-warning" disabled={deciding || refunding}
              onClick={() => onDecide({ decision: 'MANUAL_REVIEW', actor, notes })}>
              {deciding === 'MANUAL_REVIEW' ? <><span className="spinner" /> Sending…</> : '⟳ Manual Review'}
            </button>
          </>
        )}
        {canRefund && (
          <button id="btnRefund" className="btn-primary" disabled={deciding || refunding}
            onClick={() => onRefund({ actor })}>
            {refunding ? <><span className="spinner" /> Processing…</> : '↑ Issue Refund'}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function DisputeDetail() {
  const { id }      = useParams()
  const navigate    = useNavigate()
  const qc          = useQueryClient()
  const [decidingType, setDecidingType] = useState(null)
  const [isRefunding, setIsRefunding]   = useState(false)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['dispute', id],
    queryFn:  () => fetchDisputeById(id),
    enabled:  !!id,
  })

  const decideMutation = useMutation({
    mutationFn: ({ decision, actor, notes }) => decideDispute(id, { decision, actor, notes }),
    onSuccess: (_, vars) => {
      toast.success(`Decision applied: ${vars.decision}`)
      qc.invalidateQueries({ queryKey: ['dispute', id] })
      qc.invalidateQueries({ queryKey: ['disputes'] })
    },
    onError:  (err) => toast.error(err.message),
    onSettled: () => setDecidingType(null),
  })

  const refundMutation = useMutation({
    mutationFn: ({ actor }) => refundDispute(id, { actor }),
    onSuccess: (data) => {
      toast.success(`Refund completed — ${data.referenceNo}`)
      qc.invalidateQueries({ queryKey: ['dispute', id] })
      qc.invalidateQueries({ queryKey: ['disputes'] })
    },
    onError:   (err) => toast.error(err.message),
    onSettled: () => setIsRefunding(false),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <span className="spinner w-7 h-7 border-brand-500 mr-3" />
        <span className="text-gray-500">Loading dispute…</span>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="card max-w-lg mx-auto">
        <div className="card-body text-center py-12">
          <p className="text-red-400 font-semibold mb-2">Failed to load dispute</p>
          <p className="text-gray-500 text-sm">{error?.message}</p>
          <button className="btn-ghost mt-4" onClick={() => navigate('/')}>← Back</button>
        </div>
      </div>
    )
  }

  const { dispute: d, events } = data

  return (
    <div className="animate-slide-up">
      {/* Back + title */}
      <div className="flex items-center gap-3 mb-6">
        <button className="btn-ghost text-xs" onClick={() => navigate(-1)}>← Back</button>
        <h1 className="gradient-text">Dispute #{d.DISPUTE_ID}</h1>
        <StatusBadge status={d.DISPUTE_STATUS} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT — main info */}
        <div className="lg:col-span-2 space-y-5">
          {/* Transaction + Customer */}
          <div className="card">
            <div className="card-header flex justify-between items-center">
              <h2>Transaction + Customer</h2>
              <span className="text-xs text-gray-600 font-mono">TXN #{d.TXN_ID}</span>
            </div>
            <div className="card-body grid grid-cols-2 gap-x-8 gap-y-3">
              {[
                ['Merchant',       d.MERCHANT_NAME],
                ['Customer',       d.CUSTOMER_NAME],
                ['Txn Amount',     currency(d.TXN_AMOUNT)],
                ['KYC Status',     d.KYC_STATUS],
                ['Txn Date',       fmt(d.TXN_TS)],
                ['Txn Status',     d.TXN_STATUS],
                ['Email',          d.EMAIL],
                ['Txn Reference',  d.TXN_REFERENCE],
              ].map(([label, val]) => (
                <div key={label}>
                  <p className="text-xs text-gray-600 mb-0.5">{label}</p>
                  <p className="text-sm text-gray-200 font-medium">{val || '—'}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Dispute info */}
          <div className="card">
            <div className="card-header"><h2>Dispute Info</h2></div>
            <div className="card-body grid grid-cols-2 gap-x-8 gap-y-3">
              {[
                ['Type',         d.DISPUTE_TYPE?.replace(/_/g, ' ')],
                ['Routing',      d.ROUTING],
                ['Claim Amount', currency(d.CLAIM_AMOUNT)],
                ['Actor',        d.ACTOR],
                ['Created',      fmt(d.CREATED_AT)],
                ['Updated',      fmt(d.UPDATED_AT)],
              ].map(([label, val]) => (
                <div key={label}>
                  <p className="text-xs text-gray-600 mb-0.5">{label}</p>
                  <p className="text-sm text-gray-200 font-medium">{val || '—'}</p>
                </div>
              ))}
              {d.NOTES && (
                <div className="col-span-2">
                  <p className="text-xs text-gray-600 mb-0.5">Notes</p>
                  <p className="text-sm text-gray-300">{d.NOTES}</p>
                </div>
              )}
            </div>

            {/* Risk meter */}
            <div className="px-6 pb-5">
              <RiskMeter score={d.RISK_SCORE || 0} />
            </div>
          </div>
        </div>

        {/* RIGHT — actions + audit trail */}
        <div className="space-y-5">
          {/* Actions */}
          <div className="card">
            <div className="card-header"><h2>Actions</h2></div>
            <div className="card-body">
              <ActionPanel
                dispute={d}
                deciding={decidingType}
                refunding={isRefunding}
                onDecide={(vars) => {
                  setDecidingType(vars.decision)
                  decideMutation.mutate(vars)
                }}
                onRefund={(vars) => {
                  setIsRefunding(true)
                  refundMutation.mutate(vars)
                }}
              />
            </div>
          </div>

          {/* Audit Timeline */}
          <div className="card">
            <div className="card-header flex justify-between items-center">
              <h2>Audit Trail</h2>
              <span className="text-xs text-gray-600">{events?.length} event{events?.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="card-body">
              {events?.length === 0
                ? <p className="text-gray-600 text-sm">No events yet.</p>
                : (
                  <div className="space-y-0">
                    {events.map((ev) => (
                      <div key={ev.EVENT_ID} className="timeline-item">
                        <EventDot type={ev.EVENT_TYPE} />
                        <div>
                          <p className="text-sm font-semibold text-gray-200 leading-tight">
                            {ev.EVENT_TYPE?.replace(/_/g, ' ')}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">{fmt(ev.CREATED_AT)}</p>
                          {ev.ACTOR && (
                            <p className="text-xs text-gray-600 mt-0.5">by <span className="text-gray-400">{ev.ACTOR}</span></p>
                          )}
                          {ev.NOTES && (
                            <p className="text-xs text-gray-600 mt-1 bg-gray-800 px-2 py-1 rounded-md">
                              {ev.NOTES}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
