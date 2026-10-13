import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { 
  Users, 
  Plus, 
  MapPin, 
  Phone, 
  Mail, 
  FileText, 
  CreditCard,
  Building2,
  X
} from 'lucide-react';

export function DealersView({ dealers, loadDealers, selectedDealerId, setSelectedDealerId, showToast }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDealer, setNewDealer] = useState({
    dealer_code: '',
    name: '',
    city: '',
    phone: '',
    email: '',
    gstin: '',
    credit_limit: '100000.00',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateDealer = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await api.createDealer({
        ...newDealer,
        credit_limit: parseFloat(newDealer.credit_limit || 0).toFixed(2),
      });
      showToast('success', 'Dealer Created', `Dealer ${res.dealer_code} - ${res.name} registered`);
      setShowAddModal(false);
      setNewDealer({
        dealer_code: '',
        name: '',
        city: '',
        phone: '',
        email: '',
        gstin: '',
        credit_limit: '100000.00',
      });
      loadDealers();
    } catch (err) {
      showToast('error', 'Creation Failed', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalCreditLimit = dealers.reduce((acc, d) => acc + (parseFloat(d.credit_limit) || 0), 0);
  const uniqueCities = new Set(dealers.map((d) => d.city).filter(Boolean)).size;

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h1>Dealer Network & Commercial Directory</h1>
          <p>Commercial profiles, credit lines, GST numbers, and contact channels across India.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          <Plus size={16} /> Register New Dealer
        </button>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon-wrap" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
            <Building2 size={24} />
          </div>
          <div>
            <div className="stat-val">{dealers.length}</div>
            <div className="stat-lbl">Active Dealers</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrap" style={{ background: 'rgba(6, 182, 212, 0.15)', color: '#22d3ee' }}>
            <MapPin size={24} />
          </div>
          <div>
            <div className="stat-val">{uniqueCities}</div>
            <div className="stat-lbl">Cities Served</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrap" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
            <CreditCard size={24} />
          </div>
          <div>
            <div className="stat-val">₹{(totalCreditLimit / 100000).toFixed(1)}L</div>
            <div className="stat-lbl">Total Credit Sanctioned</div>
          </div>
        </div>
      </div>

      {/* Dealers Cards Grid */}
      <div className="grid-cards">
        {dealers.map((dealer) => {
          const isSelected = selectedDealerId === dealer.id;
          return (
            <div
              key={dealer.id}
              className="product-card"
              style={{
                borderColor: isSelected ? 'var(--primary)' : undefined,
                boxShadow: isSelected ? '0 0 20px rgba(99, 102, 241, 0.25)' : undefined,
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
                  <span className="mono-badge" style={{ fontWeight: 700, color: '#047857' }}>
                    {dealer.dealer_code}
                  </span>
                  {isSelected && (
                    <span style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 600, background: 'rgba(16, 185, 129, 0.15)', padding: '2px 8px', borderRadius: '12px' }}>
                      Active Persona
                    </span>
                  )}
                </div>

                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-bright)', marginBottom: '0.5rem' }}>
                  {dealer.name}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  {dealer.city && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <MapPin size={14} color="#06b6d4" /> {dealer.city}
                    </div>
                  )}
                  {dealer.phone && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Phone size={14} color="#a855f7" /> {dealer.phone}
                    </div>
                  )}
                  {dealer.email && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Mail size={14} color="#3b82f6" /> {dealer.email}
                    </div>
                  )}
                  {dealer.gstin && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                      <FileText size={14} color="#64748b" /> GSTIN: {dealer.gstin}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Credit Limit</div>
                  <div className="currency-amount" style={{ color: '#34d399', fontSize: '1rem' }}>
                    ₹{parseFloat(dealer.credit_limit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <button
                  className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setSelectedDealerId(dealer.id)}
                >
                  {isSelected ? 'Selected' : 'Select'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Dealer Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Register New Dealer</div>
              <button className="modal-close-btn" onClick={() => setShowAddModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateDealer}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 600 }}>
                    Dealer Code *
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. DLR-026"
                    value={newDealer.dealer_code}
                    onChange={(e) => setNewDealer({ ...newDealer, dealer_code: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 600 }}>
                    Credit Limit (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    value={newDealer.credit_limit}
                    onChange={(e) => setNewDealer({ ...newDealer, credit_limit: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 600 }}>
                  Dealership / Business Name *
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Apex Auto Spares"
                  value={newDealer.name}
                  onChange={(e) => setNewDealer({ ...newDealer, name: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 600 }}>
                    City
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Pune"
                    value={newDealer.city}
                    onChange={(e) => setNewDealer({ ...newDealer, city: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 600 }}>
                    Phone Number
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. +91 98765 43210"
                    value={newDealer.phone}
                    onChange={(e) => setNewDealer({ ...newDealer, phone: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 600 }}>
                    Email
                  </label>
                  <input
                    type="email"
                    className="input"
                    placeholder="dealer@example.com"
                    value={newDealer.email}
                    onChange={(e) => setNewDealer({ ...newDealer, email: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 600 }}>
                    GSTIN
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="27ABCDE1234F1Z5"
                    value={newDealer.gstin}
                    onChange={(e) => setNewDealer({ ...newDealer, gstin: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Registering...' : 'Register Dealer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
