import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { 
  Search, 
  Plus, 
  SlidersHorizontal, 
  Edit3, 
  ShoppingCart, 
  TrendingUp, 
  CheckCircle,
  AlertCircle,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { isForecastSku } from '../constants';

export function ProductsView({ searchTerm, setSearchTerm, onAddToDraft, onViewForecast, showToast }) {
  const [products, setProducts] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [search, setSearch] = useState(searchTerm || '');
  const [category, setCategory] = useState('');
  const [vehicle, setVehicle] = useState('');

  useEffect(() => {
    if (searchTerm !== undefined && searchTerm !== search) {
      setSearch(searchTerm);
      setPage(1);
    }
  }, [searchTerm]);

  // Stock Adjustment Modal
  const [adjustModalSku, setAdjustModalSku] = useState(null);
  const [newStockQty, setNewStockQty] = useState('');
  const [stockReason, setStockReason] = useState('Stock count correction');
  const [isSubmittingStock, setIsSubmittingStock] = useState(false);

  // New Product Modal
  const [showNewProductModal, setShowNewProductModal] = useState(false);
  const [newProductForm, setNewProductForm] = useState({
    sku: '',
    name: '',
    category: '',
    brand: '',
    vehicle_fitment: '',
    price: '',
    description: '',
  });

  const loadProducts = async () => {
    setLoading(true);
    try {
      const data = await api.getProducts({
        page,
        page_size: pageSize,
        search: search.trim() || undefined,
        category: category || undefined,
        vehicle: vehicle.trim() || undefined,
      });
      setProducts(data.results || []);
      setCount(data.count || 0);
    } catch (err) {
      showToast('error', 'Failed to load products', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [page, category]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      loadProducts();
    }, 350);
    return () => clearTimeout(timer);
  }, [search, vehicle]);

  const handleStockUpdate = async (e) => {
    e.preventDefault();
    if (newStockQty === '' || isNaN(newStockQty) || Number(newStockQty) < 0) {
      showToast('error', 'Validation Error', 'Quantity must be an integer ≥ 0');
      return;
    }
    setIsSubmittingStock(true);
    try {
      const res = await api.updateInventory(adjustModalSku.sku, Number(newStockQty), stockReason);
      showToast('success', 'Stock Updated', `SKU ${res.sku} stock set to ${res.quantity}`);
      setAdjustModalSku(null);
      loadProducts();
    } catch (err) {
      showToast('error', 'Update Failed', err.message);
    } finally {
      setIsSubmittingStock(false);
    }
  };

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    try {
      await api.createProduct({
        ...newProductForm,
        price: parseFloat(newProductForm.price).toFixed(2),
      });
      showToast('success', 'Product Created', `SKU ${newProductForm.sku} added to catalog`);
      setShowNewProductModal(false);
      setNewProductForm({
        sku: '',
        name: '',
        category: '',
        brand: '',
        vehicle_fitment: '',
        price: '',
        description: '',
      });
      loadProducts();
    } catch (err) {
      showToast('error', 'Creation Failed', err.message);
    }
  };

  const totalPages = Math.ceil(count / pageSize) || 1;

  const categories = [
    'All Categories',
    'Brakes',
    'Engine',
    'Transmission',
    'Suspension',
    'Electrical',
    'Filters',
    'Body',
  ];

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h1>Automotive Parts & Inventory</h1>
          <p>Browse {count.toLocaleString()} spare part SKUs, inspect stock levels, and execute adjustments.</p>
        </div>
        <button 
          className="btn btn-primary"
          onClick={() => setShowNewProductModal(true)}
        >
          <Plus size={16} /> Add New SKU
        </button>
      </div>

      {/* Filters Bar */}
      <div className="glass-panel" style={{ marginBottom: '1.5rem', padding: '1.1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="search-bar-wrap" style={{ flex: '1 1 260px' }}>
            <Search className="search-icon" size={17} />
            <input
              type="text"
              className="input search-input"
              placeholder="Search by SKU, Part Name, Brand..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{ flex: '1 1 180px' }}>
            <select
              className="select"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value === 'All Categories' ? '' : e.target.value);
                setPage(1);
              }}
            >
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div style={{ flex: '1 1 200px' }}>
            <input
              type="text"
              className="input"
              placeholder="Filter by vehicle (e.g. Pulsar 150)..."
              value={vehicle}
              onChange={(e) => setVehicle(e.target.value)}
            />
          </div>

          <button 
            className="btn btn-secondary" 
            onClick={() => { setSearch(''); setCategory(''); setVehicle(''); setPage(1); }}
          >
            Reset Filters
          </button>
        </div>
      </div>

      {/* Table Section */}
      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>SKU Code</th>
                <th>Part Description</th>
                <th>Category</th>
                <th>Brand</th>
                <th>Vehicle Fitment</th>
                <th>Unit Price</th>
                <th>Stock</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                    Loading catalogue products...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                    No products found matching the criteria.
                  </td>
                </tr>
              ) : (
                products.map((item) => {
                  let stockClass = 'stock-in';
                  if (item.stock === 0) stockClass = 'stock-out';
                  else if (item.stock < 15) stockClass = 'stock-low';

                  return (
                    <tr key={item.sku}>
                      <td>
                        <span className="mono-badge">{item.sku}</span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#f8fafc' }}>{item.name}</div>
                        {item.description && (
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.description}
                          </div>
                        )}
                      </td>
                      <td>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-main)' }}>{item.category}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>{item.brand}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{item.vehicle_fitment}</span>
                      </td>
                      <td>
                        <span className="currency-amount">₹{parseFloat(item.price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </td>
                      <td>
                        <span className={stockClass} style={{ fontSize: '0.9rem' }}>
                          {item.stock} units
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            title="Adjust inventory"
                            onClick={() => {
                              setAdjustModalSku(item);
                              setNewStockQty(item.stock);
                            }}
                          >
                            <Edit3 size={14} /> Stock
                          </button>
                          {isForecastSku(item.sku) ? (
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ borderColor: 'rgba(6, 182, 212, 0.45)', color: '#22d3ee' }}
                              title="View 4-Week ML Demand Forecast"
                              onClick={() => onViewForecast && onViewForecast(item.sku)}
                            >
                              <TrendingUp size={14} color="#06b6d4" /> Forecast
                            </button>
                          ) : (
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ opacity: 0.6 }}
                              title="ML forecast available for 40 key monitored SKUs"
                              onClick={() => {
                                if (showToast) {
                                  showToast('info', 'ML Model Scope', `SKU ${item.sku} is outside the 40 ML-monitored catalogue. Opening ML forecast overview.`);
                                }
                                if (onViewForecast) onViewForecast('FIL-1016');
                              }}
                            >
                              <TrendingUp size={14} /> Forecast
                            </button>
                          )}
                          <button
                            className="btn btn-primary btn-sm"
                            title="Add to draft order"
                            onClick={() => onAddToDraft && onAddToDraft(item)}
                          >
                            <ShoppingCart size={14} /> Draft
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.9rem 1.25rem', borderTop: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
            Showing {products.length > 0 ? (page - 1) * pageSize + 1 : 0} to {Math.min(page * pageSize, count)} of {count} products
          </span>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              className="btn btn-secondary btn-sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft size={15} /> Prev
            </button>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f8fafc' }}>
              Page {page} of {totalPages}
            </span>
            <button
              className="btn btn-secondary btn-sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Adjust Inventory Modal */}
      {adjustModalSku && (
        <div className="modal-overlay" onClick={() => setAdjustModalSku(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Adjust Available Stock</div>
              <button className="modal-close-btn" onClick={() => setAdjustModalSku(null)}>
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: '1.25rem', padding: '0.85rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span className="mono-badge">{adjustModalSku.sku}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Current: {adjustModalSku.stock} units</span>
              </div>
              <div style={{ fontWeight: 600, color: 'var(--text-bright)' }}>{adjustModalSku.name}</div>
            </div>

            <form onSubmit={handleStockUpdate}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem', fontWeight: 600 }}>
                  New Available Stock Quantity
                </label>
                <input
                  type="number"
                  min="0"
                  className="input"
                  value={newStockQty}
                  onChange={(e) => setNewStockQty(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem', fontWeight: 600 }}>
                  Adjustment Reason
                </label>
                <input
                  type="text"
                  className="input"
                  value={stockReason}
                  onChange={(e) => setStockReason(e.target.value)}
                  placeholder="e.g. Physical inventory recount / supplier receipt"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setAdjustModalSku(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmittingStock}>
                  {isSubmittingStock ? 'Saving...' : 'Confirm Stock Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Product Modal */}
      {showNewProductModal && (
        <div className="modal-overlay" onClick={() => setShowNewProductModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Create New Catalog Product</div>
              <button className="modal-close-btn" onClick={() => setShowNewProductModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateProduct}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 600 }}>
                    SKU Code *
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. ENG-9921"
                    value={newProductForm.sku}
                    onChange={(e) => setNewProductForm({ ...newProductForm, sku: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 600 }}>
                    Unit Price (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="input"
                    placeholder="e.g. 1499.50"
                    value={newProductForm.price}
                    onChange={(e) => setNewProductForm({ ...newProductForm, price: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 600 }}>
                  Part Name *
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Synthetic Engine Oil 10W-40 1L"
                  value={newProductForm.name}
                  onChange={(e) => setNewProductForm({ ...newProductForm, name: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 600 }}>
                    Category
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Engine"
                    value={newProductForm.category}
                    onChange={(e) => setNewProductForm({ ...newProductForm, category: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 600 }}>
                    Brand
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Castrol"
                    value={newProductForm.brand}
                    onChange={(e) => setNewProductForm({ ...newProductForm, brand: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 600 }}>
                  Vehicle Fitment
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Universal / Bajaj Pulsar 150"
                  value={newProductForm.vehicle_fitment}
                  onChange={(e) => setNewProductForm({ ...newProductForm, vehicle_fitment: e.target.value })}
                />
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 600 }}>
                  Description
                </label>
                <textarea
                  rows="2"
                  className="input textarea"
                  placeholder="Technical specifications, grade, compatibility notes..."
                  value={newProductForm.description}
                  onChange={(e) => setNewProductForm({ ...newProductForm, description: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowNewProductModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
