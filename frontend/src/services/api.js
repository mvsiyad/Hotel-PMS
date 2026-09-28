import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('pms_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('pms_token')
      localStorage.removeItem('pms_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// Auth
export const login = (email, password) =>
  api.post('/auth/login', { email, password })

// Hotels
export const getHotels = () => api.get('/hotels')
export const createHotel = (data) => api.post('/hotels', data)
export const updateHotel = (id, data) => api.patch(`/hotels/${id}`, data)

// Room Types
export const getRoomTypes = (hotelId) => api.get(`/hotels/${hotelId}/room-types`)
export const createRoomType = (hotelId, data) => api.post(`/hotels/${hotelId}/room-types`, data)
export const updateRoomType = (hotelId, id, data) => api.patch(`/hotels/${hotelId}/room-types/${id}`, data)

// Rooms
export const getRooms = (hotelId, params) => api.get(`/hotels/${hotelId}/rooms`, { params })
export const createRoom = (hotelId, data) => api.post(`/hotels/${hotelId}/rooms`, data)
export const getRoom = (hotelId, roomId) => api.get(`/hotels/${hotelId}/rooms/${roomId}`)
export const updateRoomStatus = (hotelId, roomId, data) =>
  api.patch(`/hotels/${hotelId}/rooms/${roomId}/status`, data)

// Availability
export const getAvailability = (hotelId, params) =>
  api.get(`/hotels/${hotelId}/availability`, { params })

// Rates
export const getRates = (hotelId) => api.get(`/hotels/${hotelId}/rates`)

// Guests
export const getGuests = (hotelId, params) => api.get(`/hotels/${hotelId}/guests`, { params })
export const createGuest = (hotelId, data) => api.post(`/hotels/${hotelId}/guests`, data)
export const getGuest = (hotelId, id) => api.get(`/hotels/${hotelId}/guests/${id}`)
export const updateGuest = (hotelId, id, data) => api.patch(`/hotels/${hotelId}/guests/${id}`, data)

// Reservations
export const getReservations = (hotelId, params) =>
  api.get(`/hotels/${hotelId}/reservations`, { params })
export const createReservation = (hotelId, data) =>
  api.post(`/hotels/${hotelId}/reservations`, data)
export const getReservation = (hotelId, id) => api.get(`/hotels/${hotelId}/reservations/${id}`)
export const updateReservation = (hotelId, id, data) =>
  api.patch(`/hotels/${hotelId}/reservations/${id}`, data)
export const checkIn = (hotelId, id, data) =>
  api.post(`/hotels/${hotelId}/reservations/${id}/check-in`, data)
export const checkOut = (hotelId, id, data) =>
  api.post(`/hotels/${hotelId}/reservations/${id}/check-out`, data)
export const cancelReservation = (hotelId, id) =>
  api.post(`/hotels/${hotelId}/reservations/${id}/cancel`)
export const noShow = (hotelId, id) =>
  api.post(`/hotels/${hotelId}/reservations/${id}/no-show`)

// Housekeeping
export const getHousekeeping = (hotelId, params) =>
  api.get(`/hotels/${hotelId}/housekeeping`, { params })
export const createHousekeepingTask = (hotelId, data) =>
  api.post(`/hotels/${hotelId}/housekeeping`, data)
export const updateHousekeepingTask = (hotelId, id, data) =>
  api.patch(`/hotels/${hotelId}/housekeeping/${id}`, data)
export const inspectTask = (hotelId, id, data) =>
  api.post(`/hotels/${hotelId}/housekeeping/${id}/inspect`, data)

// Maintenance
export const getMaintenance = (hotelId, params) =>
  api.get(`/hotels/${hotelId}/maintenance`, { params })
export const createMaintenance = (hotelId, data) =>
  api.post(`/hotels/${hotelId}/maintenance`, data)
export const updateMaintenance = (hotelId, id, data) =>
  api.patch(`/hotels/${hotelId}/maintenance/${id}`, data)

// Room Service
export const getMenu = (hotelId) => api.get(`/hotels/${hotelId}/room-service/menu`)
export const createMenuItem = (hotelId, data) =>
  api.post(`/hotels/${hotelId}/room-service/menu`, data)
export const getRoomServiceOrders = (hotelId, params) =>
  api.get(`/hotels/${hotelId}/room-service/orders`, { params })
export const createRoomServiceOrder = (hotelId, data) =>
  api.post(`/hotels/${hotelId}/room-service/orders`, data)
export const updateRoomServiceOrder = (hotelId, id, data) =>
  api.patch(`/hotels/${hotelId}/room-service/orders/${id}`, data)

// Staff
export const getStaff = (hotelId, params) => api.get(`/hotels/${hotelId}/staff`, { params })
export const createStaff = (hotelId, data) => api.post(`/hotels/${hotelId}/staff`, data)
export const updateStaff = (hotelId, id, data) => api.patch(`/hotels/${hotelId}/staff/${id}`, data)
export const disableStaff = (hotelId, id) =>
  api.delete(`/hotels/${hotelId}/staff/${id}/disable`)

// Integrations
export const getIntegrations = (hotelId) => api.get(`/hotels/${hotelId}/integrations`)
export const createIntegration = (hotelId, data) =>
  api.post(`/hotels/${hotelId}/integrations`, data)
export const updateIntegration = (hotelId, id, data) =>
  api.patch(`/hotels/${hotelId}/integrations/${id}`, data)
export const rotateSecret = (hotelId, id) =>
  api.post(`/hotels/${hotelId}/integrations/${id}/rotate`)
export const revokeIntegration = (hotelId, id) =>
  api.delete(`/hotels/${hotelId}/integrations/${id}/revoke`)
export const getIntegrationToken = (clientId, clientSecret) =>
  api.post('/integrations/token', { client_id: clientId, client_secret: clientSecret })

// Audit Logs
export const getAuditLogs = (hotelId, params) =>
  api.get(`/hotels/${hotelId}/audit-logs`, { params })

// Webhooks
export const getWebhooks = (hotelId) => api.get(`/hotels/${hotelId}/webhooks`)
export const createWebhook = (hotelId, data) => api.post(`/hotels/${hotelId}/webhooks`, data)
export const deleteWebhook = (hotelId, id) => api.delete(`/hotels/${hotelId}/webhooks/${id}`)

// Dev tools
export const seedDemo = (hotelId) => api.post(`/dev/seed/${hotelId}`)

export default api
