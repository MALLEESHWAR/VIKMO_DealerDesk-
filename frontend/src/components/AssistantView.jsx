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
  ExternalLink,
  Info
} from 'lucide-react';

function renderInline(text, onSelectProduct) {
  if (!text) return null;
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  const tokens = [];
  let lastIdx = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      tokens.push({ type: 'text', val: text.substring(lastIdx, match.index) });
    }
    const raw = match[0];
    if (raw.startsWith('`') && raw.endsWith('`')) {
      const codeVal = raw.slice(1, -1);
      const isSku = /^[A-Za-z0-9]{2,10}-[A-Za-z0-9]{2,10}$/.test(codeVal) && !codeVal.startsWith('ORD-');
      tokens.push({ type: 'code', val: codeVal, isSku });
    } else if (raw.startsWith('**') && raw.endsWith('**')) {
      tokens.push({ type: 'bold', val: raw.slice(2, -2) });
    } else if (raw.startsWith('*') && raw.endsWith('*')) {
      tokens.push({ type: 'italic', val: raw.slice(1, -1) });
    }
    lastIdx = regex.lastIndex;
  }
  if (lastIdx < text.length) {
    tokens.push({ type: 'text', val: text.substring(lastIdx) });
  }

  return tokens.map((token, idx) => {
    if (token.type === 'code') {
      if (token.isSku && onSelectProduct) {
        return (
          <span
            key={idx}
            className="assistant-inline-sku"
            onClick={(e) => {
              e.stopPropagation();
              onSelectProduct(token.val);
            }}
            title={`View ${token.val} in Catalogue`}
          >
            {token.val}
          </span>
        );
      }
      return (
        <span key={idx} className="mono-badge" style={{ fontSize: '0.8rem', padding: '0.1rem 0.35rem' }}>
          {token.val}
        </span>
      );
    }
    if (token.type === 'bold') {
      return (
        <strong key={idx} style={{ color: '#f8fafc', fontWeight: 600 }}>
          {token.val}
        </strong>
      );
    }
    if (token.type === 'italic') {
      return (
        <em key={idx} style={{ color: '#cbd5e1' }}>
          {token.val}
        </em>
      );
    }
    return <span key={idx}>{token.val}</span>;
  });
}

function StructuredMessage({ content, onSelectProduct }) {
  if (!content) return null;

  const lines = content.split('\n');
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // 1. Check for Table block (starts with `|` and ends with `|`)
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const tableLines = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }

      if (tableLines.length >= 2) {
        const headerCells = tableLines[0]
          .split('|')
          .slice(1, -1)
          .map((c) => c.trim());

        const dataStartIdx = tableLines[1].includes('---') ? 2 : 1;
        const dataRows = tableLines.slice(dataStartIdx).map((tl) =>
          tl.split('|').slice(1, -1).map((c) => c.trim())
        );

        elements.push(
          <div key={`tbl-${i}`} className="assistant-table-wrapper">
            <table className="assistant-markdown-table">
              <thead>
                <tr>
                  {headerCells.map((hc, idx) => (
                    <th key={idx}>{renderInline(hc, onSelectProduct)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataRows.map((row, rIdx) => (
                  <tr key={rIdx}>
                    {row.map((cell, cIdx) => (
                      <td key={cIdx}>{renderInline(cell, onSelectProduct)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    // 2. Headings: ### or ## or #
    if (trimmed.startsWith('#')) {
      const headingText = trimmed.replace(/^#+\s*/, '');
      elements.push(
        <h4 key={`h-${i}`} className="assistant-heading">
          <Sparkles size={14} color="#38bdf8" />
          <span>{renderInline(headingText, onSelectProduct)}</span>
        </h4>
      );
      i++;
      continue;
    }

    // 3. Blockquotes / Callouts: >
    if (trimmed.startsWith('>')) {
      const quoteText = trimmed.replace(/^>\s*/, '');
      elements.push(
        <div key={`quote-${i}`} className="assistant-callout">
          <Info size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>{renderInline(quoteText, onSelectProduct)}</div>
        </div>
      );
      i++;
      continue;
    }

    // 4. List Items: - , * , • or 1.
    if (/^[-*•]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
      const listItems = [];
      while (
        i < lines.length &&
        (/^[-*•]\s+/.test(lines[i].trim()) || /^\d+\.\s+/.test(lines[i].trim()))
      ) {
        const itemLine = lines[i].trim().replace(/^[-*•]\s+/, '').replace(/^\d+\.\s+/, '');
        listItems.push(itemLine);
        i++;
      }

      elements.push(
        <div key={`list-${i}`} className="assistant-list">
          {listItems.map((item, idx) => (
            <div key={idx} className="assistant-list-item">
              <span style={{ color: '#38bdf8', marginRight: '6px' }}>•</span>
              {renderInline(item, onSelectProduct)}
            </div>
          ))}
        </div>
      );
      continue;
    }

    // 5. Regular paragraph
    elements.push(
      <p key={`p-${i}`} className="assistant-paragraph">
        {renderInline(line, onSelectProduct)}
      </p>
    );
    i++;
  }

  return <div className="assistant-structured-content">{elements}</div>;
}

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
                  {isUser ? (
                    <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                  ) : (
                    <StructuredMessage content={msg.content} onSelectProduct={onSelectProduct} />
                  )}

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
