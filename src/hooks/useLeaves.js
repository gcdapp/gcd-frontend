'use client'
import { useState, useEffect, useCallback } from 'react'
import { leavesApi } from '../lib/api/leaves'

export function useLeaves(params = {}) {
  const [leaves,  setLeaves]  = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  // Stable key so the effect only re-runs when filters actually change
  const paramsKey = JSON.stringify(params)

  const load = useCallback(async (signal) => {
    setLoading(true)
    setError(null)
    try {
      const data = await leavesApi.list(JSON.parse(paramsKey))
      if (!signal?.aborted) setLeaves(data.leaves || [])
    } catch(e) {
      if (!signal?.aborted) setError(e.message)
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [paramsKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const ctrl = new AbortController()
    load(ctrl.signal)
    return () => ctrl.abort()
  }, [load])

  // Two-step workflow: POC, then final approval (Admin/General Manager).
  const approve = useCallback(async (id, status, step) => {
    const fn = step === 'poc' ? leavesApi.pocApprove : leavesApi.adminApprove
    await fn(id, status)
    await load()
  }, [load])

  const create = useCallback(async (data) => {
    const result = await leavesApi.create(data)
    await load()
    return result.leave
  }, [load])

  const remove = useCallback(async (id) => {
    await leavesApi.remove(id)
    setLeaves(prev => prev.filter(l => l.id !== id))
  }, [])

  return { leaves, loading, error, refresh: load, approve, create, remove }
}
