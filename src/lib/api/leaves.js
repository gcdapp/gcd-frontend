import { api } from './client'

export const leavesApi = {
  list:           (params = {}) => api.get(`/api/leaves?${new URLSearchParams(params)}`),
  create:         (data)        => api.post('/api/leaves', data),
  pocApprove:     (id, status)  => api.patch(`/api/leaves/${id}/status`,  { status }),
  adminApprove:   (id, status)  => api.patch(`/api/leaves/${id}/manager`, { status }),
  remove:         (id)          => api.delete(`/api/leaves/${id}`),
}
