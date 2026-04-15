// src/api/disputeApi.js
// All fetch calls centralised here. Never put fetch logic in components.

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })

  const json = await res.json()

  if (!res.ok || json.success === false) {
    const err = new Error(json.error || `HTTP ${res.status}`)
    err.status  = res.status
    err.details = json.details
    throw err
  }

  return json.data
}

// ── Health ────────────────────────────────────────────────────────────────────
export const fetchDbHealth = () => request('/health/db')

// ── Disputes ──────────────────────────────────────────────────────────────────
export const fetchDisputes = (params = {}) => {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null))
  ).toString()
  return request(`/disputes${qs ? `?${qs}` : ''}`)
}

export const fetchDisputeById = (id) => request(`/disputes/${id}`)

export const createDispute = (body) =>
  request('/disputes', { method: 'POST', body: JSON.stringify(body) })

export const decideDispute = (id, body) =>
  request(`/disputes/${id}/decision`, { method: 'POST', body: JSON.stringify(body) })

export const refundDispute = (id, body) =>
  request(`/disputes/${id}/refund`, { method: 'POST', body: JSON.stringify(body) })
