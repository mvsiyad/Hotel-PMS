import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'
import {
  getMenu, createMenuItem, getRoomServiceOrders, createRoomServiceOrder, updateRoomServiceOrder,
  getRooms, getGuests
} from '../services/api'
import { Badge, Modal, FormGroup, Currency, DateTimeDisplay, LoadingOverlay } from '../components/UI'

export default function RoomService() {
  const { hotelId } = useAuth()
  const [menu, setMenu] = useState([])
  const [orders, setOrders] = useState([])
  const [rooms, setRooms] = useState([])
  const [guests, setGuests] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('orders')
  const [showOrder, setShowOrder] = useState(false)
  const [showMenuItem, setShowMenuItem] = useState(false)
  const [itemForm, setItemForm] = useState({ name: '', category: 'FOOD', price: '', description: '' })
  const [orderForm, setOrderForm] = useState({ room_id: '', guest_id: '', items: [], special_instructions: '' })
  const [orderItems, setOrderItems] = useState([])

  const load = async () => {
    const [m, o, r, g] = await Promise.all([
      getMenu(hotelId).catch(() => ({ data: [] })),
      getRoomServiceOrders(hotelId).catch(() => ({ data: [] })),
      getRooms(hotelId).catch(() => ({ data: [] })),
      getGuests(hotelId).catch(() => ({ data: [] })),
    ])
    setMenu(m.data)
    setOrders(o.data)
    setRooms(r.data)
    setGuests(g.data)
    setLoading(false)
  }

  useEffect(() => { if (hotelId) load() }, [hotelId])

  const handleCreateMenuItem = async (e) => {
    e.preventDefault()
    try {
      await createMenuItem(hotelId, { ...itemForm, price: parseFloat(itemForm.price) })
      toast.success('Menu item added')
      setShowMenuItem(false)
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed')
    }
  }

  const handleCreateOrder = async (e) => {
    e.preventDefault()
    if (orderItems.length === 0) { toast.error('Add at least one item'); return }
    try {
      await createRoomServiceOrder(hotelId, {
        room_id: parseInt(orderForm.room_id),
        guest_id: orderForm.guest_id ? parseInt(orderForm.guest_id) : null,
        special_instructions: orderForm.special_instructions,
        items: orderItems.map((i) => ({ item_id: i.id, quantity: i.qty })),
      })
      toast.success('Order placed')
      setShowOrder(false)
      setOrderItems([])
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed')
    }
  }

  const handleOrderStatus = async (order, status) => {
    try {
      await updateRoomServiceOrder(hotelId, order.id, { status })
      toast.success(`Order → ${status}`)
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Invalid transition')
    }
  }

  const addToOrder = (item) => {
    setOrderItems((prev) => {
      const existing = prev.find((i) => i.id === item.id)
      if (existing) return prev.map((i) => i.id === item.id ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { ...item, qty: 1 }]
    })
  }

  const ORDER_TRANSITIONS = {
    PLACED: ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['PREPARING', 'CANCELLED'],
    PREPARING: ['READY'],
    READY: ['DELIVERED'],
    DELIVERED: [],
    CANCELLED: [],
  }

  if (loading) return <LoadingOverlay />

  const categories = [...new Set(menu.map((m) => m.category))]

  return (
    <div>
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">Room Service</div>
          <div className="topbar-subtitle">{menu.length} menu items · {orders.length} orders</div>
        </div>
        <div className="topbar-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => setShowMenuItem(true)}>+ Menu Item</button>
          <button className="btn btn-primary btn-sm" onClick={() => { setShowOrder(true); setOrderItems([]) }}>+ New Order</button>
        </div>
      </div>

      <div className="page-container">
        <div className="tabs">
          <button className={`tab ${tab === 'orders' ? 'active' : ''}`} onClick={() => setTab('orders')}>🍽 Orders</button>
          <button className={`tab ${tab === 'menu' ? 'active' : ''}`} onClick={() => setTab('menu')}>📋 Menu</button>
        </div>

        {tab === 'orders' && (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Room</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Placed At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No orders yet</td></tr>
                )}
                {orders.map((o) => {
                  const room = rooms.find((r) => r.id === o.room_id)
                  return (
                    <tr key={o.id}>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>#{o.id}</td>
                      <td>{room ? `Room ${room.room_number}` : `#${o.room_id}`}</td>
                      <td><Currency amount={o.total_amount} /></td>
                      <td><Badge status={o.status} /></td>
                      <td><DateTimeDisplay date={o.created_at} /></td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {(ORDER_TRANSITIONS[o.status] || []).map((s) => (
                            <button key={s} className="btn btn-secondary btn-sm" onClick={() => handleOrderStatus(o, s)}>→ {s}</button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'menu' && (
          <div>
            {categories.map((cat) => (
              <div key={cat} style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>{cat}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                  {menu.filter((m) => m.category === cat).map((item) => (
                    <div key={item.id} className="card" style={{ padding: 16 }}>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>{item.name}</div>
                      {item.description && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>{item.description}</div>}
                      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--gold)' }}>
                        <Currency amount={item.price} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Menu Item */}
      <Modal open={showMenuItem} onClose={() => setShowMenuItem(false)} title="Add Menu Item"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowMenuItem(false)}>Cancel</button>
            <button className="btn btn-primary" form="menu-form" type="submit">Add Item</button>
          </>
        }
      >
        <form id="menu-form" onSubmit={handleCreateMenuItem}>
          <div className="grid-2">
            <FormGroup label="Name">
              <input value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} required />
            </FormGroup>
            <FormGroup label="Category">
              <select value={itemForm.category} onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}>
                {['FOOD', 'BEVERAGE', 'ALCOHOL', 'DESSERT', 'BREAKFAST', 'SNACK'].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </FormGroup>
          </div>
          <FormGroup label="Price ($)">
            <input type="number" step="0.01" value={itemForm.price} onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })} required />
          </FormGroup>
          <FormGroup label="Description">
            <textarea value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} />
          </FormGroup>
        </form>
      </Modal>

      {/* Place Order */}
      <Modal open={showOrder} onClose={() => setShowOrder(false)} title="Place Room Service Order" wide
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowOrder(false)}>Cancel</button>
            <button className="btn btn-primary" form="order-form" type="submit">Place Order (${orderItems.reduce((s, i) => s + i.price * i.qty, 0).toFixed(2)})</button>
          </>
        }
      >
        <form id="order-form" onSubmit={handleCreateOrder}>
          <div className="grid-2" style={{ marginBottom: 20 }}>
            <FormGroup label="Room">
              <select value={orderForm.room_id} onChange={(e) => setOrderForm({ ...orderForm, room_id: e.target.value })} required>
                <option value="">Select room...</option>
                {rooms.filter((r) => r.status === 'OCCUPIED').map((r) => <option key={r.id} value={r.id}>Room {r.room_number}</option>)}
              </select>
            </FormGroup>
            <FormGroup label="Guest (optional)">
              <select value={orderForm.guest_id} onChange={(e) => setOrderForm({ ...orderForm, guest_id: e.target.value })}>
                <option value="">Select guest...</option>
                {guests.map((g) => <option key={g.id} value={g.id}>{g.first_name} {g.last_name}</option>)}
              </select>
            </FormGroup>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label>Select Items</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8, marginTop: 8 }}>
              {menu.map((item) => {
                const inOrder = orderItems.find((i) => i.id === item.id)
                return (
                  <div
                    key={item.id}
                    onClick={() => addToOrder(item)}
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      border: `1px solid ${inOrder ? 'var(--primary)' : 'var(--border)'}`,
                      background: inOrder ? 'var(--primary-glow)' : 'var(--bg-tertiary)',
                      cursor: 'pointer',
                      transition: 'all 150ms',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{item.name}</div>
                    <div style={{ color: 'var(--gold)', fontWeight: 700 }}>${item.price}</div>
                    {inOrder && <div style={{ fontSize: 11, color: 'var(--primary)', marginTop: 4 }}>× {inOrder.qty}</div>}
                  </div>
                )
              })}
            </div>
          </div>

          {orderItems.length > 0 && (
            <div className="alert alert-info" style={{ marginBottom: 12 }}>
              {orderItems.map((i) => `${i.name} ×${i.qty}`).join(', ')} — Total: ${orderItems.reduce((s, i) => s + i.price * i.qty, 0).toFixed(2)}
            </div>
          )}

          <FormGroup label="Special Instructions">
            <input value={orderForm.special_instructions} onChange={(e) => setOrderForm({ ...orderForm, special_instructions: e.target.value })} placeholder="Allergies, preferences..." />
          </FormGroup>
        </form>
      </Modal>
    </div>
  )
}
