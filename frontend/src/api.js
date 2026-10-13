// VIKMO DealerDesk API Client

const BASE_URL = ''; // Relative path, proxied by Vite to http://127.0.0.1:8000

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const defaultHeaders = {
    'Accept': 'application/json',
  };

  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    defaultHeaders['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });

  const contentType = response.headers.get('content-type');
  let data = null;
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const error = new Error(
      data?.error?.message ||
      data?.message ||
      (typeof data === 'string' ? data : `Request failed with status ${response.status}`)
    );
    error.status = response.status;
    error.data = data;
    error.code = data?.error?.code || 'ERROR';
    error.details = data?.error?.details || [];
    throw error;
  }

  return data;
}

export const api = {
  // Health
  getHealth: () => request('/api/health/'),

  // Products
  getProducts: (params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', params.page);
    if (params.page_size) searchParams.set('page_size', params.page_size);
    if (params.search) searchParams.set('search', params.search);
    if (params.category) searchParams.set('category', params.category);
    if (params.vehicle) searchParams.set('vehicle', params.vehicle);
    const qs = searchParams.toString();
    return request(`/api/products/${qs ? `?${qs}` : ''}`);
  },

  getProduct: (sku) => request(`/api/products/${encodeURIComponent(sku)}/`),

  createProduct: (productData) =>
    request('/api/products/', {
      method: 'POST',
      body: productData,
    }),

  updateProduct: (sku, patchData) =>
    request(`/api/products/${encodeURIComponent(sku)}/`, {
      method: 'PATCH',
      body: patchData,
    }),

  // Inventory
  updateInventory: (sku, quantity, reason = 'manual stock update') =>
    request(`/api/inventory/${encodeURIComponent(sku)}/`, {
      method: 'PUT',
      body: { quantity: Number(quantity), reason },
    }),

  // Dealers
  getDealers: (params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', params.page);
    if (params.page_size) searchParams.set('page_size', params.page_size);
    const qs = searchParams.toString();
    return request(`/api/dealers/${qs ? `?${qs}` : ''}`);
  },

  getDealer: (id) => request(`/api/dealers/${id}/`),

  createDealer: (dealerData) =>
    request('/api/dealers/', {
      method: 'POST',
      body: dealerData,
    }),

  // Orders
  getOrders: (params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', params.page);
    if (params.page_size) searchParams.set('page_size', params.page_size);
    if (params.dealer_id) searchParams.set('dealer_id', params.dealer_id);
    if (params.status) searchParams.set('status', params.status);
    const qs = searchParams.toString();
    return request(`/api/orders/${qs ? `?${qs}` : ''}`);
  },

  getOrderDetail: (orderNumber) =>
    request(`/api/orders/${encodeURIComponent(orderNumber)}/`),

  createOrder: (orderData, idempotencyKey = null) => {
    const headers = {};
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }
    return request('/api/orders/', {
      method: 'POST',
      body: orderData,
      headers,
    });
  },

  updateOrder: (orderNumber, items) =>
    request(`/api/orders/${encodeURIComponent(orderNumber)}/`, {
      method: 'PUT',
      body: { items },
    }),

  confirmOrder: (orderNumber) =>
    request(`/api/orders/${encodeURIComponent(orderNumber)}/confirm/`, {
      method: 'POST',
    }),

  dispatchOrder: (orderNumber) =>
    request(`/api/orders/${encodeURIComponent(orderNumber)}/dispatch/`, {
      method: 'POST',
    }),

  deliverOrder: (orderNumber) =>
    request(`/api/orders/${encodeURIComponent(orderNumber)}/deliver/`, {
      method: 'POST',
    }),

  cancelOrder: (orderNumber) =>
    request(`/api/orders/${encodeURIComponent(orderNumber)}/cancel/`, {
      method: 'POST',
    }),

  // Supplier Sync
  syncSupplier: () =>
    request('/api/sync/supplier/', {
      method: 'POST',
    }),

  // AI Assistant
  chatAssistant: (sessionId, dealerId, message) =>
    request('/api/assistant/chat/', {
      method: 'POST',
      body: {
        session_id: sessionId,
        dealer_id: dealerId,
        message,
      },
    }),

  // Forecasting & Reorders
  getForecast: (sku) =>
    request(`/api/forecast/${encodeURIComponent(sku)}/`),

  getReorderSuggestions: () =>
    request('/api/reorder-suggestions/'),
};
