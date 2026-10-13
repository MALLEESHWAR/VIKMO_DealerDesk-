import React from 'react';
import { 
  Package, 
  ShoppingCart, 
  Users, 
  Bot, 
  TrendingUp, 
  RefreshCw, 
  Activity,
  Layers
} from 'lucide-react';

export function Navbar({ 
  activeTab, 
  setActiveTab, 
  dealers, 
  selectedDealerId, 
  setSelectedDealerId,
  healthStatus 
}) {
  const tabs = [
    { id: 'products', label: 'Products & Stock', icon: Package },
    { id: 'orders', label: 'Orders & Fulfillment', icon: ShoppingCart },
    { id: 'dealers', label: 'Dealers', icon: Users },
    { id: 'assistant', label: 'AI Assistant', icon: Bot },
    { id: 'forecast', label: 'ML Forecast', icon: TrendingUp },
    { id: 'supplier', label: 'Supplier Sync', icon: RefreshCw },
  ];

  return (
    <header className="navbar">
      <div className="brand-section">
        <div className="brand-logo-badge">
          <Layers size={22} strokeWidth={2.5} />
        </div>
        <div>
          <div className="brand-title">
            VIKMO <span>DealerDesk</span>
            <span className="brand-badge">B2B Portal</span>
          </div>
        </div>
      </div>

      <nav className="nav-links">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`nav-tab-btn ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </nav>

      <div className="nav-actions">
        <div className="dealer-selector-wrap">
          <span className="dealer-selector-label">Dealer:</span>
          <select
            className="dealer-select"
            value={selectedDealerId || ''}
            onChange={(e) => setSelectedDealerId(Number(e.target.value))}
          >
            {dealers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.dealer_code} - {d.name.length > 18 ? d.name.substring(0, 18) + '...' : d.name}
              </option>
            ))}
          </select>
        </div>

        <div className="system-status-pill">
          <span className="status-dot"></span>
          <span>{healthStatus === 'ok' ? 'API Online' : 'Connecting...'}</span>
        </div>
      </div>
    </header>
  );
}
