import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { createDispute } from '../api/disputeApi.js'

const DISPUTE_TYPES = [
  { value: 'DUPLICATE_CHARGE',      label: 'Duplicate Charge' },
  { value: 'SERVICE_NOT_DELIVERED', label: 'Service Not Delivered' },
  { value: 'WRONG_AMOUNT',          label: 'Wrong Amount' },
  { value: 'FRAUD_SUSPECTED',       label: 'Fraud Suspected' },
]

const INITIAL = { txnId: '', custId: '', disputeType: '', claimAmount: '', actor: '' }

export default function CreateDisputeForm() {
  const navigate           = useNavigate()
  const [form, setForm]    = useState(INITIAL)
  const [errors, setErrors] = useState({})

  const mutation = useMutation({
    mutationFn: createDispute,
    onSuccess: (data) => {
      toast.success(`Dispute #${data.disputeId} created! ${data.message}`)
      navigate(`/disputes/${data.disputeId}`)
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to create dispute')
    },
  })

  function validate() {
    const e = {}
    if (!form.txnId       || isNaN(form.txnId)       || Number(form.txnId) < 1)   e.txnId = 'Valid Transaction ID required'
    if (!form.custId      || isNaN(form.custId)      || Number(form.custId) < 1)   e.custId = 'Valid Customer ID required'
    if (!form.disputeType) e.disputeType = 'Select a dispute type'
    if (!form.claimAmount || isNaN(form.claimAmount) || Number(form.claimAmount) <= 0) e.claimAmount = 'Enter a valid amount > 0'
    if (!form.actor.trim()) e.actor = 'Actor name is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return
    mutation.mutate({
      txnId:       Number(form.txnId),
      custId:      Number(form.custId),
      disputeType: form.disputeType,
      claimAmount: Number(form.claimAmount),
      actor:       form.actor.trim(),
    })
  }

  const set = (field) => (e) => setForm((p) => ({ ...p, [field]: e.target.value }))

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="gradient-text mb-2">Create New Dispute</h1>
        <p className="text-gray-500 text-sm">
          Submit a transaction dispute. Our system will auto-route based on amount, risk score, and KYC status.
        </p>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {[
          { label: 'Auto-approve', desc: '≤ ₹5,000 + Full KYC + Low Risk', color: 'emerald' },
          { label: 'Manual Review', desc: '> ₹5,000 or High Risk > 70', color: 'amber' },
          { label: 'KYC Gate', desc: 'Partial/None KYC → Manual', color: 'red' },
        ].map(({ label, desc, color }) => (
          <div key={label} className={`glass p-3 border-${color}-800/40`}>
            <p className={`text-${color}-400 text-xs font-semibold uppercase tracking-wider mb-1`}>{label}</p>
            <p className="text-gray-400 text-xs">{desc}</p>
          </div>
        ))}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="card">
        <div className="card-header">
          <h2 className="text-gray-100">Dispute Details</h2>
        </div>
        <div className="card-body space-y-5">
          <div className="grid grid-cols-2 gap-4">
            {/* txnId */}
            <div>
              <label className="form-label">Transaction ID</label>
              <input id="txnId" type="number" min="1" className="form-input"
                placeholder="e.g. 1" value={form.txnId} onChange={set('txnId')} />
              {errors.txnId && <p className="form-error">{errors.txnId}</p>}
              <p className="text-gray-600 text-xs mt-1">Seed txn IDs: 1–5</p>
            </div>
            {/* custId */}
            <div>
              <label className="form-label">Customer ID</label>
              <input id="custId" type="number" min="1" className="form-input"
                placeholder="e.g. 1" value={form.custId} onChange={set('custId')} />
              {errors.custId && <p className="form-error">{errors.custId}</p>}
              <p className="text-gray-600 text-xs mt-1">1=Priya, 2=Rahul, 3=Aisha</p>
            </div>
          </div>

          {/* disputeType */}
          <div>
            <label className="form-label">Dispute Type</label>
            <select id="disputeType" className="form-select"
              value={form.disputeType} onChange={set('disputeType')}>
              <option value="">— Select dispute type —</option>
              {DISPUTE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            {errors.disputeType && <p className="form-error">{errors.disputeType}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* claimAmount */}
            <div>
              <label className="form-label">Claim Amount (₹)</label>
              <input id="claimAmount" type="number" min="0.01" step="0.01" className="form-input"
                placeholder="e.g. 2500" value={form.claimAmount} onChange={set('claimAmount')} />
              {errors.claimAmount && <p className="form-error">{errors.claimAmount}</p>}
            </div>
            {/* actor */}
            <div>
              <label className="form-label">Actor / Agent ID</label>
              <input id="actor" type="text" className="form-input"
                placeholder="e.g. agent-007" value={form.actor} onChange={set('actor')} />
              {errors.actor && <p className="form-error">{errors.actor}</p>}
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center gap-3 pt-2">
            <button id="submitDispute" type="submit" className="btn-primary flex-1 justify-center py-2.5"
              disabled={mutation.isPending}>
              {mutation.isPending
                ? <><span className="spinner" /> Submitting…</>
                : <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 4v16m8-8H4" />
                    </svg>
                    Create Dispute
                  </>
              }
            </button>
            <button type="button" className="btn-ghost" onClick={() => navigate('/')}>
              Cancel
            </button>
          </div>

          {/* API error */}
          {mutation.isError && (
            <div className="bg-red-950/50 border border-red-800 rounded-lg px-4 py-3 text-red-300 text-sm animate-fade-in">
              <strong>Error:</strong> {mutation.error?.message}
            </div>
          )}
        </div>
      </form>
    </div>
  )
}
