import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { 
  Bot, 
  Send, 
  Sparkles, 
  User, 
  Wrench, 
  Package, 
  CheckCircle, 
  ShoppingBag, 
  RotateCcw,
  ExternalLink
} from 'lucide-react';

export function AssistantView({ selectedDealerId, dealers, onNavigateToOrder, onSelectProduct, showToast }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Hello! I am VIKMO DealerDesk AI Assistant. I can search compatible automotive spare parts, check live warehouse stock levels, and automatically generate draft purchase orders for you. How can I assist you today?`,
      cited_skus: [],
      tool_calls: [],
      actions: [],
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(() => 'sess_' + Math.random().toString(36).substring(2, 11));
  const messagesEndRef = useRef(null);

  const activeDealer = dealers.find((d) => d.id === selectedDealerId) || dealers[0] || { id: 7, name: 'Dealer' };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSendMessage = async (textToSend) => {
    const text = textToSend || inputMessage;
    if (!text.trim() || loading) return;

    const userMsg = {
      role: 'user',
      content: text,
      cited_skus: [],
      tool_calls: [],
      actions: [],
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setLoading(true);

    try {
      const response = await api.chatAssistant(sessionId, activeDealer.id, text);
      const assistantMsg = {
        role: 'assistant',
        content: response.reply,
        cited_skus: response.cited_skus || [],
        tool_calls: response.tool_calls || [],
        actions: response.actions || [],
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      showToast('error', 'Assistant Error', err.message);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `⚠️ Error from assistant: ${err.message}`,
          cited_skus: [],
          tool_calls: [],
          actions: [],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleResetSession = () => {
    setSessionId('sess_' + Math.random().toString(36).substring(2, 11));
    setMessages([
      {
        role: 'assistant',
        content: `Session memory cleared. Ready for new inquiries under ${activeDealer.name}.`,
        cited_skus: [],
        tool_calls: [],
        actions: [],
      },
    ]);
    showToast('info', 'Session Reset', 'Conversation context refreshed');
  };

  const quickPrompts = [
    'Do you have brake pads for Bajaj Pulsar 150?',
    'Check stock for BRK-1044 and create a draft order of 3 units',
    'What engine oils or filters are available for Royal Enfield Classic 350?',
    'What are the highest stock brake components available?',
  ];

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h1>AI Dealer Operations Assistant</h1>
          <p>
            Autonomous GenAI agent with tool-calling capabilities. Powered by live catalog retrieval and draft order automation.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
            Context: <strong style={{ color: '#a5b4fc' }}>{activeDealer.dealer_code}</strong>
          </span>
          <button className="btn btn-secondary btn-sm" onClick={handleResetSession}>
            <RotateCcw size={14} /> New Chat Session
          </button>
        </div>
      </div>

      <div className="chat-container">
        {/* Messages Scroll Area */}
        <div className="chat-messages">
          {messages.map((msg, index) => {
            const isUser = msg.role === 'user';
            return (
              <div key={index} className={`message-row ${isUser ? 'user' : 'assistant'}`}>
                <div className={`message-avatar ${isUser ? 'avatar-user' : 'avatar-assistant'}`}>
                  {isUser ? <User size={18} /> : <Bot size={20} />}
                </div>

                <div className="message-bubble">
                  <div>{msg.content}</div>

                  {/* Actions (e.g. Draft order created) */}
                  {msg.actions && msg.actions.length > 0 && (
                    <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {msg.actions.map((act, idx) => (
                        <div
                          key={idx}
                          style={{
                            background: 'rgba(16, 185, 129, 0.15)',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            padding: '0.5rem 0.75rem',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            color: '#34d399',
                            fontSize: '0.8rem',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <CheckCircle size={16} />
                            <span>Action Executed: <strong>{act.type}</strong></span>
                            {act.order_number && (
                              <span className="mono-badge" style={{ color: '#ffffff', background: 'rgba(0,0,0,0.3)' }}>
                                {act.order_number}
                              </span>
                            )}
                          </div>
                          {act.order_number && (
                            <button
                              className="btn btn-sm btn-success"
                              style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}
                              onClick={() => onNavigateToOrder && onNavigateToOrder(act.order_number)}
                            >
                              View Order <ExternalLink size={12} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Tool Calls Log Drawer */}
                  {msg.tool_calls && msg.tool_calls.length > 0 && (
                    <div className="tool-calls-container">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#06b6d4', fontWeight: 600, marginBottom: '0.3rem' }}>
                        <Wrench size={13} /> Tool Calls Executed ({msg.tool_calls.length})
                      </div>
                      {msg.tool_calls.map((t, idx) => (
                        <div key={idx} style={{ marginTop: '3px' }}>
                          <span style={{ color: '#a5b4fc', fontWeight: 600 }}>{t.name}</span>
                          <span style={{ color: '#64748b' }}>({JSON.stringify(t.arguments || {})})</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Cited SKUs Pills */}
                  {msg.cited_skus && msg.cited_skus.length > 0 && (
                    <div className="cited-skus-container">
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8', alignSelf: 'center', marginRight: '4px' }}>
                        Referenced SKUs:
                      </span>
                      {msg.cited_skus.map((sku) => (
                        <button
                          key={sku}
                          className="cited-sku-pill"
                          onClick={() => onSelectProduct && onSelectProduct(sku)}
                          title="Click to view part in catalogue"
                        >
                          {sku}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="message-row assistant">
              <div className="message-avatar avatar-assistant">
                <Bot size={20} />
              </div>
              <div className="message-bubble" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#94a3b8' }}>
                <Sparkles size={16} className="status-dot" />
                <span>Assistant is evaluating tools & database...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Prompts Bar */}
        <div style={{ padding: '0.6rem 1.25rem', background: 'rgba(15, 23, 42, 0.6)', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: '0.5rem', overflowX: 'auto' }}>
          {quickPrompts.map((prompt, i) => (
            <button
              key={i}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}
              onClick={() => handleSendMessage(prompt)}
            >
              <Sparkles size={12} color="#06b6d4" /> {prompt}
            </button>
          ))}
        </div>

        {/* Chat Input */}
        <form
          className="chat-input-area"
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
        >
          <input
            type="text"
            className="input"
            style={{ flex: 1 }}
            placeholder={`Ask for parts, stock availability, or draft order creation for ${activeDealer.name}...`}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            disabled={loading}
          />
          <button type="submit" className="btn btn-primary" disabled={loading || !inputMessage.trim()}>
            <Send size={16} /> Send
          </button>
        </form>
      </div>
    </div>
  );
}
