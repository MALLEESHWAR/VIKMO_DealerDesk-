import React, { useState, useEffect } from 'react';
import { api } from './api';
import { Navbar } from './components/Navbar';
import { ToastContainer } from './components/Toast';
import { ProductsView } from './components/ProductsView';
import { OrdersView } from './components/OrdersView';
import { DealersView } from './components/DealersView';
import { AssistantView } from './components/AssistantView';
import { ForecastView } from './components/ForecastView';
import { SupplierSyncView } from './components/SupplierSyncView';

export function App() {
  const [activeTab, setActiveTab] = useState('products');
  const [dealers, setDealers] = useState([]);
  const [selectedDealerId, setSelectedDealerId] = useState(7);
  const [healthStatus, setHealthStatus] = useState('checking');
  const [toasts, setToasts] = useState([]);
  
  // Cross-view state transfers
  const [draftCart, setDraftCart] = useState([]);
  const [forecastSku, setForecastSku] = useState(null);

  const showToast = (type, title, message) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 6);
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Poll health and load dealers on mount
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await api.getHealth();
        setHealthStatus(res.status);
      } catch (e) {
        setHealthStatus('error');
      }
    };

    const loadDealersList = async () => {
      try {
        const res = await api.getDealers({ page_size: 50 });
        const list = res.results || [];
        setDealers(list);
        if (list.length > 0 && !list.some((d) => d.id === selectedDealerId)) {
          setSelectedDealerId(list[0].id);
        }
      } catch (e) {
        console.error('Failed to load dealers', e);
      }
    };

    checkHealth();
    loadDealersList();

    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleAddToDraft = (product) => {
    setDraftCart((prev) => [...prev, { ...product, quantity: 1 }]);
    setActiveTab('orders');
    showToast('info', 'Added to Draft Order', `${product.sku} placed in draft builder`);
  };

  const [productSearchTerm, setProductSearchTerm] = useState('');

  const handleSelectProduct = (sku) => {
    setProductSearchTerm(sku);
    setActiveTab('products');
    showToast('info', 'Catalogue Filter', `Filtering catalogue for SKU ${sku}`);
  };

  const handleViewForecast = (sku) => {
    setForecastSku(sku);
    setActiveTab('forecast');
  };

  return (
    <div className="app-container">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        dealers={dealers}
        selectedDealerId={selectedDealerId}
        setSelectedDealerId={setSelectedDealerId}
        healthStatus={healthStatus}
      />

      <main className="main-content">
        {activeTab === 'products' && (
          <ProductsView
            searchTerm={productSearchTerm}
            setSearchTerm={setProductSearchTerm}
            onAddToDraft={handleAddToDraft}
            onViewForecast={handleViewForecast}
            showToast={showToast}
          />
        )}

        {activeTab === 'orders' && (
          <OrdersView
            dealers={dealers}
            selectedDealerId={selectedDealerId}
            draftCart={draftCart}
            setDraftCart={setDraftCart}
            showToast={showToast}
          />
        )}

        {activeTab === 'dealers' && (
          <DealersView
            dealers={dealers}
            loadDealers={async () => {
              const res = await api.getDealers({ page_size: 50 });
              setDealers(res.results || []);
            }}
            selectedDealerId={selectedDealerId}
            setSelectedDealerId={setSelectedDealerId}
            showToast={showToast}
          />
        )}

        {activeTab === 'assistant' && (
          <AssistantView
            selectedDealerId={selectedDealerId}
            dealers={dealers}
            onNavigateToOrder={(orderNumber) => {
              setActiveTab('orders');
            }}
            onSelectProduct={handleSelectProduct}
            showToast={showToast}
          />
        )}

        {activeTab === 'forecast' && (
          <ForecastView
            initialSku={forecastSku}
            onAddToDraft={handleAddToDraft}
            showToast={showToast}
          />
        )}

        {activeTab === 'supplier' && (
          <SupplierSyncView showToast={showToast} />
        )}
      </main>

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}

export default App;
