import { createContext, useContext, useState, useEffect } from 'react'
import { login as apiLogin } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [hotelId, setHotelId] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('pms_token')
    const savedUser = localStorage.getItem('pms_user')
    const savedHotelId = localStorage.getItem('pms_hotel_id')
    if (token && savedUser) {
      setUser(JSON.parse(savedUser))
      setHotelId(savedHotelId ? parseInt(savedHotelId) : null)
    }
    setLoading(false)
  }, [])

  const login = async (email, password) => {
    const resp = await apiLogin(email, password)
    const data = resp.data
    localStorage.setItem('pms_token', data.access_token)
    localStorage.setItem('pms_user', JSON.stringify(data))
    const hid = data.hotel_id || 1  // Default to hotel 1 for admin
    localStorage.setItem('pms_hotel_id', hid)
    setUser(data)
    setHotelId(hid)
    return data
  }

  const logout = () => {
    localStorage.removeItem('pms_token')
    localStorage.removeItem('pms_user')
    localStorage.removeItem('pms_hotel_id')
    setUser(null)
    setHotelId(null)
  }

  const hasPermission = (perm) => {
    if (!user) return false
    if (user.role === 'PMS_ADMIN') return true
    return user.permissions?.includes(perm)
  }

  return (
    <AuthContext.Provider value={{ user, hotelId, loading, login, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
