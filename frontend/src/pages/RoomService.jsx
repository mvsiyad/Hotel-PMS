import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import {
  UtensilsCrossed,
  BookOpen,
  Plus,
  ArrowRight,
  Clock,
  CheckCircle2,
  DollarSign
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import {
  getMenu,
  createMenuItem,
  getRoomServiceOrders,
  createRoomServiceOrder,
  updateRoomServiceOrder,
  getRooms,
  getGuests,
} from '../services/api'
import { Badge, Modal, FormGroup, Currency, DateTimeDisplay, LoadingOverlay } from '../components/UI'
import Topbar from '../components/Topbar'

const ORDER_TRANSITIONS = {
  PLACED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY'],
  READY: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
}

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

  useEffect(() => {
    if (hotelId) load()
  }, [hotelId])

  const handleCreateMenuItem = async (e) => {
    e.preventDefault()
    try {
      await createMenuItem(hotelId, { ...itemForm, price: parseFloat(itemForm.price) })
      toast.success('Menu item successfully cataloged')
      setShowMenuItem(false)
      setItemForm({ name: '', category: 'FOOD', price: '', description: '' })
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add item')
    }
  }

  const handleCreateOrder = async (e) => {
    e.preventDefault()
    if (orderItems.length === 0) {
      toast.error('Please select at least one menu item')
      return
    }
    try {
      await createRoomServiceOrder(hotelId, {
        room_id: parseInt(orderForm.room_id),
        guest_id: orderForm.guest_id ? parseInt(orderForm.guest_id) : null,
        special_instructions: orderForm.special_instructions,
        items: orderItems.map((i) => ({ item_id: i.id, quantity: i.qty })),
      })
      toast.success('Room service order dispatched to kitchen')
      setShowOrder(false)
      setOrderItems([])
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to place order')
    }
  }

  const handleOrderStatus = async (order, status) => {
    try {
      await updateRoomServiceOrder(hotelId, order.id, { status })
      toast.success(`Order #${order.id} transitioned to ${status}`)
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Invalid status transition')
    }
  }

  const addToOrder = (item) => {
    setOrderItems((prev) => {
      const existing = prev.find((i) => i.id === item.id)
      if (existing) return prev.map((i) => (i.id === item.id ? { ...i, qty: i.qty + 1 } : i))
      return [...prev, { ...item, qty: 1 }]
    })
  }

  if (loading) return <LoadingOverlay />

  const categories = [...new Set(menu.map((m) => m.category))]

  return (
    <div>
      <Topbar
        title="In-Room Dining"
        subtitle={`${menu.length} items cataloged · ${orders.length} orders processed`}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowMenuItem(true)}>
              <Plus size={13} />
              <span>Catalog Item</span>
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setShowOrder(true)
                setOrderItems([])
              }}
            >
              <Plus size={14} />
              <span>Dispatch Order</span>
            </button>
          </div>
        }
      />

      <div className="page-container">
        {/* Navigation Tabs */}
        <div className="tabs">
          <button
            className={`tab ${tab === 'orders' ? 'active' : ''}`}
            onClick={() => setTab('orders')}
          >
            <UtensilsCrossed size={13} />
            <span>Kitchen Orders</span>
          </button>
          <button
            className={`tab ${tab === 'menu' ? 'active' : ''}`}
            onClick={() => setTab('menu')}
          >
            <BookOpen size={13} />
            <span>Menu Catalog</span>
          </button>
        </div>

        {tab === 'orders' && (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Destination Unit</th>
                  <th>Total Amount</th>
                  <th>Kitchen Status</th>
                  <th>Time Placed</th>
                  <th style={{ textAlign: 'right' }}>Workflow</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}
                    >
                      No room service orders in the queue
                    </td>
                  </tr>
                ) : (
                  orders.map((o) => {
                    const room = rooms.find((r) => r.id === o.room_id)
                    return (
                      <tr key={o.id}>
                        <td>
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: 12,
                              color: 'var(--text-muted)',
                            }}
                          >
                            #{o.id}
                          </span>
                        </td>
                        <td>
                          <strong>{room ? `Room ${room.room_number}` : `Unit #${o.room_id}`}</strong>
                        </td>
                        <td>
                          <Currency amount={o.total_amount} />
                        </td>
                        <td>
                          <Badge status={o.status} />
                        </td>
                        <td>
                          <DateTimeDisplay date={o.created_at} />
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div
                            style={{
                              display: 'inline-flex',
                              gap: 6,
                              justifyContent: 'flex-end',
                            }}
                          >
                            {(ORDER_TRANSITIONS[o.status] || []).map((s) => (
                              <button
                                key={s}
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '3px 8px', fontSize: 11 }}
                                onClick={() => handleOrderStatus(o, s)}
                              >
                                <ArrowRight size={11} />
                                <span>{s}</span>
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'menu' && (
          <div>
            {categories.map((cat) => (
              <div key={cat} style={{ marginBottom: 28 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: 0.8,
                    marginBottom: 12,
                  }}
                >
                  {cat}
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                    gap: 12,
                  }}
                >
                  {menu
                    .filter((m) => m.category === cat)
                    .map((item) => (
                      <div key={item.id} className="card" style={{ padding: 16 }}>
                        <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 4 }}>
                          {item.name}
                        </div>
                        {item.description && (
                          <div
                            style={{
                              fontSize: 12,
                              color: 'var(--text-muted)',
                              marginBottom: 10,
                              lineHeight: 1.4,
                            }}
                          >
                            {item.description}
                          </div>
                        )}
                        <div
                          style={{
                            fontSize: 16,
                            fontWeight: 700,
                            color: 'var(--primary)',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
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

      {/* Add Menu Item Modal */}
      <Modal
        open={showMenuItem}
        onClose={() => setShowMenuItem(false)}
        title="Add Menu Item"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowMenuItem(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" form="menu-form" type="submit">
              Catalog Item
            </button>
          </>
        }
      >
        <form id="menu-form" onSubmit={handleCreateMenuItem}>
          <div className="grid-2">
            <FormGroup label="Item Name">
              <input
                value={itemForm.name}
                onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                required
              />
            </FormGroup>
            <FormGroup label="Category">
              <select
                value={itemForm.category}
                onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
              >
                {['FOOD', 'BEVERAGE', 'ALCOHOL', 'DESSERT', 'BREAKFAST', 'SNACK'].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </FormGroup>
          </div>
          <FormGroup label="Price (USD)">
            <input
              type="number"
              step="0.01"
              value={itemForm.price}
              onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })}
              required
            />
          </FormGroup>
          <FormGroup label="Culinary Description">
            <textarea
              value={itemForm.description}
              onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
            />
          </FormGroup>
        </form>
      </Modal>

      {/* Place Order Modal */}
      <Modal
        open={showOrder}
        onClose={() => setShowOrder(false)}
        title="Dispatch Room Service Order"
        wide
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowOrder(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" form="order-form" type="submit">
              Confirm Order (${orderItems.reduce((s, i) => s + i.price * i.qty, 0).toFixed(2)})
            </button>
          </>
        }
      >
        <form id="order-form" onSubmit={handleCreateOrder}>
          <div className="grid-2" style={{ marginBottom: 16 }}>
            <FormGroup label="Destination Room">
              <select
                value={orderForm.room_id}
                onChange={(e) => setOrderForm({ ...orderForm, room_id: e.target.value })}
                required
              >
                <option value="">Select occupied unit...</option>
                {rooms
                  .filter((r) => r.status === 'OCCUPIED' || true)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      Room {r.room_number} ({r.status})
                    </option>
                  ))}
              </select>
            </FormGroup>
            <FormGroup label="Guest Profile (Optional)">
              <select
                value={orderForm.guest_id}
                onChange={(e) => setOrderForm({ ...orderForm, guest_id: e.target.value })}
              >
                <option value="">Select registered guest...</option>
                {guests.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.first_name} {g.last_name}
                  </option>
                ))}
              </select>
            </FormGroup>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label>Select Items for Tray</label>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
                gap: 8,
                marginTop: 8,
              }}
            >
              {menu.map((item) => {
                const inOrder = orderItems.find((i) => i.id === item.id)
                return (
                  <div
                    key={item.id}
                    onClick={() => addToOrder(item)}
                    style={{
                      padding: 10,
                      borderRadius: 'var(--radius-md)',
                      border: `1px solid ${inOrder ? 'var(--primary)' : 'var(--border)'}`,
                      background: inOrder ? 'var(--primary-tint)' : 'var(--bg-tertiary)',
                      cursor: 'pointer',
                      transition: 'all var(--transition-fast)',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 12.5 }}>{item.name}</div>
                    <div style={{ color: 'var(--primary)', fontWeight: 700, fontSize: 13 }}>
                      ${item.price}
                    </div>
                    {inOrder && (
                      <div
                        style={{
                          fontSize: 10.5,
                          color: 'var(--primary)',
                          marginTop: 4,
                          fontWeight: 600,
                        }}
                      >
                        Quantity: {inOrder.qty}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <FormGroup label="Kitchen Notes & Dietary Restrictions">
            <input
              value={orderForm.special_instructions}
              onChange={(e) =>
                setOrderForm({ ...orderForm, special_instructions: e.target.value })
              }
              placeholder="e.g. Extra cutlery, dressing on side..."
            />
          </FormGroup>
        </form>
      </Modal>
    </div>
  )
}
