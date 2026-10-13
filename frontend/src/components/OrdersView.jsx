import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { 
  ShoppingCart, 
  Plus, 
  CheckCircle2, 
  Truck, 
  Check, 
  XCircle, 
  Eye, 
  AlertCircle, 
  Trash2, 
  ArrowRight,
  RefreshCw,
  Search,
  X
} from 'lucide-react';

export function OrdersView({ dealers, selectedDealerId, draftCart, setDraftCart, showToast }) {
  const [orders, setOrders] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Insufficient stock error modal
  const [stockErrorModal, setStockErrorModal] = useState(null);

  // Create order builder state
  const [targetDealerId, setTargetDealerId] = useState(selectedDealerId || (dealers[0]?.id || 1));
  const [skuSearchQuery, setSkuSearchQuery] = useState('');
  const [skuSearchResults, setSkuSearchResults] = useState([]);
  const [orderItems, setOrderItems] = useState([]);

  // Sync draftCart if passed from ProductsView
  useEffect(() => {
    if (draftCart && draftCart.length > 0) {
      setOrderItems((prev) => {
        const merged = [...prev];
        draftCart.forEach((item) => {
          const existing = merged.find((m) => m.sku === item.sku);
          if (existing) {
            existing.quantity += item.quantity || 1;
          } else {
            merged.push({
              sku: item.sku,
              name: item.name,
              price: item.price,
              quantity: item.quantity || 1,
            });
          }
        });
        return merged;
      });
      setShowCreateModal(true);
      if (setDraftCart) setDraftCart([]);
    }
  }, [draftCart]);

  useEffect(() => {
    if (selectedDealerId) {
      setTargetDealerId(selectedDealerId);
    }
  }, [selectedDealerId]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const data = await api.getOrders({
        page,
        page_size: 15,
        status: statusFilter || undefined,
        dealer_id: selectedDealerId || undefined,
      });
      setOrders(data.results || []);
      setCount(data.count || 0);
    } catch (err) {
      showToast('error', 'Failed to load orders', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [page, statusFilter, selectedDealerId]);

  // Search products for order builder
  useEffect(() => {
    if (!skuSearchQuery.trim()) {
      setSkuSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.getProducts({ search: skuSearchQuery, page_size: 5 });
        setSkuSearchResults(res.results || []);
      } catch (e) {
        console.error(e);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [skuSearchQuery]);

  const handleAddItemToOrder = (prod) => {
    const exists = orderItems.find((i) => i.sku === prod.sku);
    if (exists) {
      setOrderItems(orderItems.map((i) => (i.sku === prod.sku ? { ...i, quantity: i.quantity + 1 } : i)));
    } else {
      setOrderItems([
        ...orderItems,
        {
          sku: prod.sku,
          name: prod.name,
          price: prod.price,
          quantity: 1,
        },
      ]);
    }
    setSkuSearchQuery('');
    setSkuSearchResults([]);
  };

  const handleRemoveItem = (sku) => {
    setOrderItems(orderItems.filter((i) => i.sku !== sku));
  };

  const handleQuantityChange = (sku, delta) => {
    setOrderItems(
      orderItems
        .map((i) => {
          if (i.sku === sku) {
            const next = i.quantity + delta;
            return next > 0 ? { ...i, quantity: next } : null;
          }
          return i;
        })
        .filter(Boolean)
    );
  };

  // Live order calculations
  const calculatedItems = orderItems.map((item) => {
    const unitPrice = parseFloat(item.price || 0);
    const lineSubtotal = Math.round(unitPrice * item.quantity * 100) / 100;
    const lineTax = Math.round(lineSubtotal * 0.18 * 100) / 100;
    const lineTotal = Math.round((lineSubtotal + lineTax) * 100) / 100;
    return { ...item, lineSubtotal, lineTax, lineTotal };
  });

  const subtotal = calculatedItems.reduce((acc, i) => acc + i.lineSubtotal, 0);
  const taxTotal = calculatedItems.reduce((acc, i) => acc + i.lineTax, 0);
  const grandTotal = Math.round((subtotal + taxTotal) * 100) / 100;

  const handleCreateDraftOrder = async () => {
    if (orderItems.length === 0) {
      showToast('error', 'Empty Order', 'Please add at least one line item to create an order');
      return;
    }
    setActionLoading(true);
    try {
      const payload = {
        dealer_id: Number(targetDealerId),
        items: orderItems.map((i) => ({ sku: i.sku, quantity: i.quantity })),
      };
      const res = await api.createOrder(payload);
      showToast('success', 'Draft Order Created', `Order ${res.order_number} created successfully`);
      setShowCreateModal(false);
      setOrderItems([]);
      loadOrders();
      setSelectedOrder(res);
    } catch (err) {
      showToast('error', 'Order Creation Failed', err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleTransition = async (action, orderNumber) => {
    setActionLoading(true);
    try {
      let res;
      if (action === 'confirm') res = await api.confirmOrder(orderNumber);
      else if (action === 'dispatch') res = await api.dispatchOrder(orderNumber);
      else if (action === 'deliver') res = await api.deliverOrder(orderNumber);
      else if (action === 'cancel') res = await api.cancelOrder(orderNumber);

      showToast('success', 'Order Status Updated', `Order ${orderNumber} is now ${res.status}`);
      setSelectedOrder(res);
      loadOrders();
    } catch (err) {
      if (err.code === 'INSUFFICIENT_STOCK' && err.details) {
        setStockErrorModal({
          orderNumber,
          message: err.message,
          details: err.details,
        });
      } else {
        showToast('error', 'Status Change Failed', err.message);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const statuses = ['', 'DRAFT', 'CONFIRMED', 'DISPATCHED', 'DELIVERED', 'CANCELLED'];

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h1>Dealer Orders & Fulfillment</h1>
          <p>End-to-end B2B order lifecycle: Draft creation, stock reservation, GST invoice calculation, and dispatch tracking.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          <Plus size={16} /> Create Draft Order
        </button>
      </div>

      {/* Filters */}
      <div className="glass-panel" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, marginRight: '0.5rem' }}>Status:</span>
          {statuses.map((st) => (
            <button
              key={st || 'ALL'}
              className={`btn btn-sm ${statusFilter === st ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setStatusFilter(st); setPage(1); }}
            >
              {st || 'ALL STATUSES'}
            </button>
          ))}
          <button 
            className="btn btn-secondary btn-sm" 
            style={{ marginLeft: 'auto' }} 
            onClick={loadOrders}
            title="Refresh Orders"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Orders Table */}
      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Order Number</th>
                <th>Dealer Code</th>
                <th>Status</th>
                <th>Items Count</th>
                <th>Subtotal</th>
                <th>18% GST</th>
                <th>Grand Total</th>
                <th>Created At</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                    Loading orders...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                    No orders found matching the filter.
                  </td>
                </tr>
              ) : (
                orders.map((ord) => {
                  const dealerObj = dealers.find((d) => d.id === ord.dealer_id);
                  const dealerName = dealerObj ? dealerObj.name : `Dealer #${ord.dealer_id}`;
                  const itemCount = ord.items ? ord.items.reduce((s, i) => s + i.quantity, 0) : 0;

                  return (
                    <tr key={ord.order_number}>
                      <td>
                        <span className="mono-badge" style={{ fontWeight: 600, color: '#a5b4fc' }}>
                          {ord.order_number}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.85rem' }}>
                          {dealerObj?.dealer_code || `#${ord.dealer_id}`}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{dealerName}</div>
                      </td>
                      <td>
                        <span className={`status-pill ${ord.status.toLowerCase()}`}>
                          {ord.status}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                          {itemCount} units ({ord.items?.length || 0} lines)
                        </span>
                      </td>
                      <td>
                        <span className="currency-amount">₹{parseFloat(ord.subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </td>
                      <td>
                        <span className="currency-amount" style={{ color: '#94a3b8' }}>₹{parseFloat(ord.tax_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </td>
                      <td>
                        <span className="currency-amount" style={{ color: '#34d399', fontWeight: 700 }}>₹{parseFloat(ord.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.775rem', color: '#94a3b8' }}>
                          {new Date(ord.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setSelectedOrder(ord)}
                          >
                            <Eye size={14} /> View
                          </button>

                          {ord.status === 'DRAFT' && (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => handleTransition('confirm', ord.order_number)}
                              disabled={actionLoading}
                              title="Deduct stock & lock prices"
                            >
                              Confirm
                            </button>
                          )}

                          {ord.status === 'CONFIRMED' && (
                            <button
                              className="btn btn-accent btn-sm"
                              onClick={() => handleTransition('dispatch', ord.order_number)}
                              disabled={actionLoading}
                            >
                              Dispatch
                            </button>
                          )}

                          {ord.status === 'DISPATCHED' && (
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => handleTransition('deliver', ord.order_number)}
                              disabled={actionLoading}
                            >
                              Deliver
                            </button>
                          )}

                          {(ord.status === 'DRAFT' || ord.status === 'CONFIRMED') && (
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleTransition('cancel', ord.order_number)}
                              disabled={actionLoading}
                              title="Cancel order"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Detail View Modal */}
      {selectedOrder && (
        <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="modal-card" style={{ maxWidth: '680px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="mono-badge" style={{ fontSize: '0.9rem' }}>{selectedOrder.order_number}</span>
                  <span className={`status-pill ${selectedOrder.status.toLowerCase()}`}>{selectedOrder.status}</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '4px' }}>
                  Placed by Dealer #{selectedOrder.dealer_id} • {new Date(selectedOrder.created_at).toLocaleString()}
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setSelectedOrder(null)}>
                <X size={20} />
              </button>
            </div>

            {/* Lifecycle Pipeline Graphic */}
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '10px', marginBottom: '1.25rem', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
                {['DRAFT', 'CONFIRMED', 'DISPATCHED', 'DELIVERED'].map((step, idx) => {
                  const stepIndex = ['DRAFT', 'CONFIRMED', 'DISPATCHED', 'DELIVERED'].indexOf(selectedOrder.status);
                  const isPassed = stepIndex >= idx && selectedOrder.status !== 'CANCELLED';
                  const isCurrent = selectedOrder.status === step;
                  return (
                    <div key={step} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2 }}>
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          background: isPassed ? '#10b981' : '#111827',
                          border: isCurrent ? '2px solid #34d399' : '1px solid var(--border-subtle)',
                          boxShadow: isCurrent ? '0 0 10px rgba(16, 185, 129, 0.5)' : 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#ffffff',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                        }}
                      >
                        {idx + 1}
                      </div>
                      <span style={{ fontSize: '0.7rem', color: isPassed ? '#f8fafc' : '#64748b', marginTop: '4px', fontWeight: 600 }}>
                        {step}
                      </span>
                    </div>
                  );
                })}
              </div>
              {selectedOrder.status === 'CANCELLED' && (
                <div style={{ marginTop: '0.75rem', textAlign: 'center', color: '#fb7185', fontSize: '0.8rem', fontWeight: 600 }}>
                  ⚠️ Order is Cancelled (Stock restored if was confirmed)
                </div>
              )}
            </div>

            {/* Line Items Table */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc', marginBottom: '0.5rem' }}>Order Line Items</div>
              <div className="table-container">
                <table className="data-table" style={{ fontSize: '0.8rem' }}>
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Product</th>
                      <th>Qty</th>
                      <th>Unit Price</th>
                      <th>Subtotal</th>
                      <th>GST 18%</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.items?.map((it) => (
                      <tr key={it.sku}>
                        <td><span className="mono-badge">{it.sku}</span></td>
                        <td><div style={{ fontWeight: 600 }}>{it.name}</div></td>
                        <td>{it.quantity}</td>
                        <td><span className="currency-amount">₹{it.unit_price}</span></td>
                        <td><span className="currency-amount">₹{it.line_subtotal}</span></td>
                        <td><span className="currency-amount" style={{ color: '#94a3b8' }}>₹{it.line_tax}</span></td>
                        <td><span className="currency-amount" style={{ color: '#34d399' }}>₹{it.line_total}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financial Summary */}
            <div style={{ background: 'rgba(15, 23, 42, 0.9)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-subtle)', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.85rem' }}>
                <span style={{ color: '#94a3b8' }}>Net Items Subtotal:</span>
                <span className="currency-amount">₹{selectedOrder.subtotal}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem' }}>
                <span style={{ color: '#94a3b8' }}>Applicable GST (18% rounded half up):</span>
                <span className="currency-amount" style={{ color: '#94a3b8' }}>₹{selectedOrder.tax_total}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)', fontSize: '1rem', fontWeight: 700 }}>
                <span style={{ color: '#f8fafc' }}>Grand Total (INR):</span>
                <span className="currency-amount" style={{ color: '#34d399', fontSize: '1.15rem' }}>₹{selectedOrder.grand_total}</span>
              </div>
            </div>

            {/* Status Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              {selectedOrder.status === 'DRAFT' && (
                <button
                  className="btn btn-primary"
                  onClick={() => handleTransition('confirm', selectedOrder.order_number)}
                  disabled={actionLoading}
                >
                  <CheckCircle2 size={16} /> Confirm Order
                </button>
              )}
              {selectedOrder.status === 'CONFIRMED' && (
                <button
                  className="btn btn-accent"
                  onClick={() => handleTransition('dispatch', selectedOrder.order_number)}
                  disabled={actionLoading}
                >
                  <Truck size={16} /> Dispatch Order
                </button>
              )}
              {selectedOrder.status === 'DISPATCHED' && (
                <button
                  className="btn btn-success"
                  onClick={() => handleTransition('deliver', selectedOrder.order_number)}
                  disabled={actionLoading}
                >
                  <Check size={16} /> Mark Delivered
                </button>
              )}
              {(selectedOrder.status === 'DRAFT' || selectedOrder.status === 'CONFIRMED') && (
                <button
                  className="btn btn-danger"
                  onClick={() => handleTransition('cancel', selectedOrder.order_number)}
                  disabled={actionLoading}
                >
                  <XCircle size={16} /> Cancel Order
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Order Modal / Interactive Order Builder */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-card" style={{ maxWidth: '680px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">New Draft Order Builder</div>
              <button className="modal-close-btn" onClick={() => setShowCreateModal(false)}>
                <X size={20} />
              </button>
            </div>

            {/* Select Dealer */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '0.35rem', fontWeight: 600 }}>
                Select Purchasing Dealer *
              </label>
              <select
                className="select"
                value={targetDealerId}
                onChange={(e) => setTargetDealerId(e.target.value)}
              >
                {dealers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.dealer_code} - {d.name} ({d.city}) • Limit: ₹{parseFloat(d.credit_limit || 0).toLocaleString()}
                  </option>
                ))}
              </select>
            </div>

            {/* Add Products to Order */}
            <div style={{ marginBottom: '1.25rem', position: 'relative' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '0.35rem', fontWeight: 600 }}>
                Search & Add Spare Parts
              </label>
              <div className="search-bar-wrap" style={{ maxWidth: '100%' }}>
                <Search className="search-icon" size={16} />
                <input
                  type="text"
                  className="input search-input"
                  placeholder="Type SKU or Part name (e.g. BRK-1044, Filter, Brake)..."
                  value={skuSearchQuery}
                  onChange={(e) => setSkuSearchQuery(e.target.value)}
                />
              </div>

              {skuSearchResults.length > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 50,
                    background: '#0d1527',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.6)',
                    marginTop: '4px',
                    maxHeight: '220px',
                    overflowY: 'auto',
                  }}
                >
                  {skuSearchResults.map((p) => (
                    <div
                      key={p.sku}
                      onClick={() => handleAddItemToOrder(p)}
                      style={{
                        padding: '0.65rem 0.85rem',
                        cursor: 'pointer',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div>
                        <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.85rem' }}>
                          <span className="mono-badge" style={{ marginRight: '6px' }}>{p.sku}</span>
                          {p.name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          {p.vehicle_fitment} • Stock: {p.stock} units
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div className="currency-amount">₹{p.price}</div>
                        <span style={{ fontSize: '0.7rem', color: '#06b6d4', fontWeight: 600 }}>+ Add</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Selected Items */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.4rem' }}>
                Selected Line Items ({orderItems.length})
              </div>
              {orderItems.length === 0 ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px dashed var(--border-subtle)', color: '#64748b' }}>
                  No items added yet. Search products above or add directly from the Products tab.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {orderItems.map((item) => (
                    <div
                      key={item.sku}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.65rem 0.85rem',
                        background: 'rgba(255,255,255,0.03)',
                        borderRadius: '8px',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0, marginRight: '1rem' }}>
                        <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.85rem' }}>
                          <span className="mono-badge" style={{ marginRight: '6px' }}>{item.sku}</span>
                          {item.name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          Unit Price: ₹{item.price}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: '#0f172a', padding: '0.2rem 0.4rem', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                          <button
                            type="button"
                            className="btn btn-sm"
                            style={{ padding: '0.1rem 0.4rem' }}
                            onClick={() => handleQuantityChange(item.sku, -1)}
                          >
                            -
                          </button>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, minWidth: '24px', textAlign: 'center' }}>
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            className="btn btn-sm"
                            style={{ padding: '0.1rem 0.4rem' }}
                            onClick={() => handleQuantityChange(item.sku, 1)}
                          >
                            +
                          </button>
                        </div>

                        <div className="currency-amount" style={{ minWidth: '70px', textAlign: 'right' }}>
                          ₹{(parseFloat(item.price || 0) * item.quantity).toFixed(2)}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.sku)}
                          style={{ background: 'transparent', border: 'none', color: '#f43f5e', cursor: 'pointer', padding: '4px' }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Calculations Preview */}
            {orderItems.length > 0 && (
              <div style={{ background: 'rgba(15, 23, 42, 0.9)', padding: '0.85rem 1.1rem', borderRadius: '10px', border: '1px solid var(--border-subtle)', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '2px' }}>
                  <span>Items Subtotal:</span>
                  <span className="currency-amount">₹{subtotal.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
                  <span>GST Total (18% per-line):</span>
                  <span className="currency-amount">₹{taxTotal.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc', paddingTop: '6px', borderTop: '1px solid var(--border-subtle)' }}>
                  <span>Estimated Grand Total:</span>
                  <span className="currency-amount" style={{ color: '#34d399' }}>₹{grandTotal.toFixed(2)}</span>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCreateDraftOrder}
                disabled={actionLoading || orderItems.length === 0}
              >
                {actionLoading ? 'Creating...' : 'Create Draft Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Insufficient Stock Error Modal */}
      {stockErrorModal && (
        <div className="modal-overlay" onClick={() => setStockErrorModal(null)}>
          <div className="modal-card" style={{ maxWidth: '540px', border: '1px solid #f43f5e' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title" style={{ color: '#fb7185', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle size={22} color="#f43f5e" /> Insufficient Warehouse Stock
              </div>
              <button className="modal-close-btn" onClick={() => setStockErrorModal(null)}>
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '1rem' }}>
              {stockErrorModal.message}
            </p>

            <div style={{ background: 'rgba(244, 63, 94, 0.08)', borderRadius: '8px', padding: '0.85rem', border: '1px solid rgba(244, 63, 94, 0.2)', marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fb7185', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                Shortage Breakdown (Requested vs Available)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {stockErrorModal.details?.map((shortItem, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#f8fafc' }}>
                    <span className="mono-badge">{shortItem.sku}</span>
                    <span>
                      Requested: <strong style={{ color: '#fb7185' }}>{shortItem.requested}</strong> | Available: <strong style={{ color: '#34d399' }}>{shortItem.available}</strong>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setStockErrorModal(null)}>
                Understood, Return to Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
