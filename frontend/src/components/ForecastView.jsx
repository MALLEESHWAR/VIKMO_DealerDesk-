import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Calendar, 
  Clock, 
  ShieldCheck, 
  BarChart2, 
  Search,
  ShoppingCart,
  RefreshCw
} from 'lucide-react';

export function ForecastView({ initialSku, onAddToDraft, showToast }) {
  const [selectedSku, setSelectedSku] = useState(initialSku || 'FIL-1016');
  const [forecastData, setForecastData] = useState(null);
  const [reorderList, setReorderList] = useState([]);
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [loadingReorders, setLoadingReorders] = useState(false);
  const [filterCriticalOnly, setFilterCriticalOnly] = useState(false);
  const [skuSearch, setSkuSearch] = useState('');

  const loadForecast = async (sku) => {
    if (!sku) return;
    setLoadingForecast(true);
    try {
      const data = await api.getForecast(sku);
      setForecastData(data);
    } catch (err) {
      showToast('error', 'Forecast Load Error', err.message);
    } finally {
      setLoadingForecast(false);
    }
  };

  const loadReorders = async () => {
    setLoadingReorders(true);
    try {
      const data = await api.getReorderSuggestions();
      const list = data.results || (Array.isArray(data) ? data : []);
      setReorderList(list);
      if (!selectedSku && list.length > 0) {
        setSelectedSku(list[0].sku);
      }
    } catch (err) {
      showToast('error', 'Reorders Load Error', err.message);
    } finally {
      setLoadingReorders(false);
    }
  };

  useEffect(() => {
    loadReorders();
  }, []);

  useEffect(() => {
    if (selectedSku) {
      loadForecast(selectedSku);
    }
  }, [selectedSku]);

  useEffect(() => {
    if (initialSku) {
      setSelectedSku(initialSku);
    }
  }, [initialSku]);

  const criticalCount = reorderList.filter((r) => r.reorder_qty > 0).length;
  const totalSuggestedUnits = reorderList.reduce((acc, r) => acc + (r.reorder_qty || 0), 0);

  const filteredReorders = reorderList.filter((item) => {
    if (filterCriticalOnly && item.reorder_qty <= 0) return false;
    if (skuSearch && !item.sku.toLowerCase().includes(skuSearch.toLowerCase())) return false;
    return true;
  });

  // Calculate SVG chart metrics for forecastData
  const weeklyForecast = forecastData?.forecast || [];
  const maxForecastUnits = Math.max(...weeklyForecast.map((w) => w.forecast_units), 10);

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h1>ML Demand Forecasting & Reorders</h1>
          <p>
            Machine learning 4-week demand horizon (2026-09-28 to 2026-10-19) with statistical safety buffers and dynamic reorder triggers.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={loadReorders} title="Reload reorder algorithms">
          <RefreshCw size={15} /> Recalculate
        </button>
      </div>

      {/* KPI Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon-wrap" style={{ background: 'rgba(244, 63, 94, 0.15)', color: '#fb7185' }}>
            <AlertTriangle size={24} />
          </div>
          <div>
            <div className="stat-val" style={{ color: criticalCount > 0 ? '#fb7185' : '#34d399' }}>
              {criticalCount} SKUs
            </div>
            <div className="stat-lbl">Action Required (Stock &lt; ROP)</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrap" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
            <ShoppingCart size={24} />
          </div>
          <div>
            <div className="stat-val">{totalSuggestedUnits.toLocaleString()}</div>
            <div className="stat-lbl">Total Recommended Reorder Units</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrap" style={{ background: 'rgba(6, 182, 212, 0.15)', color: '#22d3ee' }}>
            <Clock size={24} />
          </div>
          <div>
            <div className="stat-val">40 SKUs</div>
            <div className="stat-lbl">ML Model Monitored Catalogue</div>
          </div>
        </div>
      </div>

      {/* Interactive Forecast Chart Section */}
      <div className="glass-panel" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BarChart2 size={20} color="#6366f1" />
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc' }}>
                4-Week Sales Forecast Projection: <span className="mono-badge" style={{ fontSize: '1rem', color: '#06b6d4' }}>{selectedSku}</span>
              </h2>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
              Projected weekly sales volume from machine learning model ml/forecast.csv
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Select SKU:</span>
            <select
              className="select"
              style={{ width: '160px' }}
              value={selectedSku}
              onChange={(e) => setSelectedSku(e.target.value)}
            >
              {reorderList.map((r) => (
                <option key={r.sku} value={r.sku}>{r.sku}</option>
              ))}
            </select>
          </div>
        </div>

        {loadingForecast ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>Loading SKU forecast curve...</div>
        ) : weeklyForecast.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>No forecast rows found for {selectedSku}</div>
        ) : (
          <div>
            {/* SVG Bar & Curve Visualizer */}
            <div style={{ background: 'rgba(15, 23, 42, 0.85)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${weeklyForecast.length}, 1fr)`, gap: '1.5rem', alignItems: 'flex-end', height: '180px', paddingBottom: '20px' }}>
                {weeklyForecast.map((w, idx) => {
                  const heightPercent = Math.max(12, Math.round((w.forecast_units / maxForecastUnits) * 100));
                  return (
                    <div key={w.week_start} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc', marginBottom: '6px' }}>
                        {w.forecast_units.toFixed(1)}
                      </span>
                      <div
                        style={{
                          width: '100%',
                          maxWidth: '64px',
                          height: `${heightPercent}%`,
                          background: idx === 0 
                            ? 'linear-gradient(180deg, #6366f1 0%, #4f46e5 100%)' 
                            : 'linear-gradient(180deg, #06b6d4 0%, #0891b2 100%)',
                          borderRadius: '6px 6px 2px 2px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                          transition: 'height 0.4s ease',
                        }}
                      />
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '8px', fontFamily: 'var(--font-mono)' }}>
                        Wk {idx + 1} ({w.week_start})
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Reorder Suggestions Table */}
      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <ShieldCheck size={18} color="#10b981" />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>
              Inventory Reorder Suggestions Engine (ROP = Demand during Lead Time + Safety Stock)
            </h3>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <div className="search-bar-wrap" style={{ width: '180px' }}>
              <Search className="search-icon" size={15} />
              <input
                type="text"
                className="input search-input"
                placeholder="Filter SKU..."
                value={skuSearch}
                onChange={(e) => setSkuSearch(e.target.value)}
                style={{ padding: '0.35rem 0.6rem 0.35rem 2rem', fontSize: '0.8rem' }}
              />
            </div>

            <button
              className={`btn btn-sm ${filterCriticalOnly ? 'btn-danger' : 'btn-secondary'}`}
              onClick={() => setFilterCriticalOnly(!filterCriticalOnly)}
            >
              {filterCriticalOnly ? 'Showing Critical Only' : 'Show Critical Only'}
            </button>
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>SKU Code</th>
                <th>Current Warehouse Stock</th>
                <th>Supplier Lead Time</th>
                <th>Lead Time Demand</th>
                <th>Safety Buffer</th>
                <th>Reorder Point (ROP)</th>
                <th>Suggested Reorder</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingReorders ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                    Computing statistical reorder suggestions...
                  </td>
                </tr>
              ) : filteredReorders.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                    No SKUs matched the filter.
                  </td>
                </tr>
              ) : (
                filteredReorders.map((r) => {
                  const isUnderROP = r.reorder_qty > 0;
                  return (
                    <tr
                      key={r.sku}
                      style={{
                        background: selectedSku === r.sku ? 'rgba(99, 102, 241, 0.08)' : undefined,
                      }}
                    >
                      <td>
                        <span className="mono-badge" style={{ fontWeight: 600 }}>{r.sku}</span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: isUnderROP ? '#fb7185' : '#34d399' }}>
                          {r.current_stock} units
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>{r.lead_time_weeks} weeks</span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>{r.lead_time_demand}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>+{r.safety_stock}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc' }}>
                          {r.reorder_point} units
                        </span>
                      </td>
                      <td>
                        {isUnderROP ? (
                          <span
                            style={{
                              background: 'rgba(244, 63, 94, 0.15)',
                              border: '1px solid rgba(244, 63, 94, 0.3)',
                              color: '#fb7185',
                              padding: '0.2rem 0.6rem',
                              borderRadius: '9999px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                            }}
                          >
                            ⚠️ Reorder +{r.reorder_qty}
                          </span>
                        ) : (
                          <span
                            style={{
                              background: 'rgba(16, 185, 129, 0.1)',
                              color: '#34d399',
                              padding: '0.2rem 0.6rem',
                              borderRadius: '9999px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                            }}
                          >
                            Stock Healthy (0)
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setSelectedSku(r.sku)}
                        >
                          Chart
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
