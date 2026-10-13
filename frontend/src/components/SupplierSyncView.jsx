import React, { useState } from 'react';
import { api } from '../api';
import { 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  ArrowDownCircle, 
  Edit, 
  Layers, 
  Globe, 
  Clock,
  Check
} from 'lucide-react';

export function SupplierSyncView({ showToast }) {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  const handleRunSync = async () => {
    setSyncing(true);
    const startTime = Date.now();
    try {
      const res = await api.syncSupplier();
      const durationMs = Date.now() - startTime;
      setSyncResult({ ...res, durationMs });
      setLastSyncTime(new Date().toLocaleTimeString());
      showToast('success', 'Supplier Sync Complete', `Processed ${res.created + res.updated + res.unchanged} unique catalog items`);
    } catch (err) {
      showToast('error', 'Supplier Sync Failed', err.message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h1>Supplier Catalog Ingestion & Sync</h1>
          <p>
            Automated synchronization pipeline connecting upstream supplier feed (Rate limiting, cursor pagination, and idempotent merge).
          </p>
        </div>
      </div>

      {/* Main Action Banner */}
      <div className="glass-panel" style={{ marginBottom: '1.5rem', background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.7) 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
              <Globe size={20} color="#06b6d4" />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc' }}>
                Supplier API Endpoint: <span className="mono-badge">http://127.0.0.1:8099/v1/products</span>
              </h2>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', maxWidth: '640px' }}>
              Sync fetches paginated batches, performs retry backoff on 429/5xx responses, discards invalid data, picks the latest updated_at per SKU, and merges updates into the PostgreSQL catalogue without altering available stock.
            </p>
          </div>

          <button
            className="btn btn-primary"
            style={{ padding: '0.75rem 1.75rem', fontSize: '0.95rem' }}
            onClick={handleRunSync}
            disabled={syncing}
          >
            <RefreshCw size={18} className={syncing ? 'status-dot' : ''} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
            {syncing ? 'Running Catalog Sync...' : 'Trigger Full Supplier Sync'}
          </button>
        </div>
      </div>

      {/* Sync Execution Metrics */}
      {syncResult && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>
              Last Sync Report (Finished at {lastSyncTime} in {(syncResult.durationMs / 1000).toFixed(2)}s)
            </h3>
            <span style={{ fontSize: '0.8rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}>
              <Check size={16} /> Sync Ingestion Status: 200 OK
            </span>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon-wrap" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
                <ArrowDownCircle size={24} />
              </div>
              <div>
                <div className="stat-val" style={{ color: '#34d399' }}>+{syncResult.created}</div>
                <div className="stat-lbl">New SKUs Created</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon-wrap" style={{ background: 'rgba(6, 182, 212, 0.15)', color: '#22d3ee' }}>
                <Edit size={24} />
              </div>
              <div>
                <div className="stat-val" style={{ color: '#22d3ee' }}>{syncResult.updated}</div>
                <div className="stat-lbl">Catalogue SKUs Updated</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon-wrap" style={{ background: 'rgba(148, 163, 184, 0.15)', color: '#cbd5e1' }}>
                <Layers size={24} />
              </div>
              <div>
                <div className="stat-val">{syncResult.unchanged}</div>
                <div className="stat-lbl">Identical / Unchanged</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon-wrap" style={{ background: 'rgba(244, 63, 94, 0.15)', color: '#fb7185' }}>
                <AlertCircle size={24} />
              </div>
              <div>
                <div className="stat-val" style={{ color: '#fb7185' }}>
                  {Array.isArray(syncResult.rejected) ? syncResult.rejected.length : syncResult.rejected}
                </div>
                <div className="stat-lbl">Invalid Records Rejected</div>
              </div>
            </div>
          </div>

          {/* Network Telemetry Card */}
          <div className="glass-panel" style={{ marginTop: '1.25rem' }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f8fafc', marginBottom: '0.75rem' }}>
              Network & Ingestion Telemetry
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', fontSize: '0.85rem' }}>
              <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.75rem', borderRadius: '8px' }}>
                <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Pages Fetched</div>
                <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '1.1rem' }}>{syncResult.pages_fetched}</div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.75rem', borderRadius: '8px' }}>
                <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>HTTP Requests Made</div>
                <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '1.1rem' }}>{syncResult.requests_made}</div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.75rem', borderRadius: '8px' }}>
                <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Total Valid Unique SKUs</div>
                <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '1.1rem' }}>
                  {syncResult.created + syncResult.updated + syncResult.unchanged}
                </div>
              </div>
            </div>

            {/* Rejected breakdown if any */}
            {Array.isArray(syncResult.rejected) && syncResult.rejected.length > 0 && (
              <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fb7185', marginBottom: '0.5rem' }}>
                  Skipped / Rejected Records Breakdown:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {syncResult.rejected.map((rej, i) => (
                    <div key={i} style={{ display: 'flex', gap: '0.75rem', fontSize: '0.8rem', color: '#cbd5e1' }}>
                      <span className="mono-badge">{rej.supplier_sku || 'UNKNOWN'}</span>
                      <span style={{ color: '#fb7185' }}>Reason: {rej.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
