import React, { useState } from 'react';

export default function Guidelines() {
  const [searchQuery, setSearchQuery] = useState('');
  const [chatMessage, setChatMessage] = useState('');
  const [chatMessages, setChatMessages] = useState([
    { role: 'ai', content: 'Hello! You can ask me questions about the Ethiopian Standard Treatment Guidelines.' }
  ]);

  const categories = ['Infectious Diseases', 'Respiratory', 'Cardiovascular', 'Pediatrics', 'Emergency'];
  
  const mockResults = [
    { id: 1, title: 'Tuberculosis Treatment Protocol', summary: 'Standard first-line regimen for adults consists of a 2-month intensive phase...', relevance: 'High' },
    { id: 2, title: 'Malaria Management', summary: 'Artemether-lumefantrine is the first-line treatment for uncomplicated P. falciparum...', relevance: 'Medium' }
  ];

  const [isAiTyping, setIsAiTyping] = useState(false);

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;
    
    const userMsg = chatMessage;
    setChatMessages([...chatMessages, { role: 'user', content: userMsg }]);
    setChatMessage('');
    setIsAiTyping(true);
    
    try {
      const response = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: userMsg }),
      });
      
      const data = await response.json();
      
      setChatMessages(prev => [...prev, { 
        role: 'ai', 
        content: data.reply,
        citation: data.sources ? data.sources.join(', ') : ''
      }]);
    } catch (err) {
      setChatMessages(prev => [...prev, { 
        role: 'ai', 
        content: 'Sorry, the backend server is offline or not responding.',
      }]);
    } finally {
      setIsAiTyping(false);
    }
  };

  return (
    <div className="guidelines">
      <header className="guidelines__header">
        <h1 className="guidelines__title">Treatment Guidelines</h1>
        <h2 className="guidelines__subtitle">የሕክምና መመሪያዎች</h2>
        <div className="guidelines__info-badge">
          Based on STG for General Hospitals - FMHACA Ethiopia
        </div>
      </header>

      <div className="guidelines__search">
        <div className="search-bar">
          <svg className="search-bar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input 
            type="text" 
            className="search-bar__input" 
            placeholder="Search STG guidelines... / መመሪያዎችን ይፈልጉ..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="categories">
          {categories.map((cat, i) => (
            <button key={i} className="category-pill">{cat}</button>
          ))}
        </div>
      </div>

      <div className="guidelines__content">
        <div className="guidelines__results">
          <h3 className="section-title">Search Results</h3>
          <div className="results-list">
            {mockResults.map(result => (
              <div key={result.id} className="result-card">
                <div className="result-card__header">
                  <h4 className="result-card__title">{result.title}</h4>
                  <span className={`badge badge--${result.relevance.toLowerCase()}`}>{result.relevance}</span>
                </div>
                <p className="result-card__summary">{result.summary}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="guidelines__chat">
          <h3 className="section-title">Ask AI Assistant</h3>
          <div className="chat-box">
            <div className="chat-box__messages">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`chat-msg chat-msg--${msg.role}`}>
                  <div className="chat-msg__bubble">
                    <p className="chat-msg__text">{msg.content}</p>
                    {msg.citation && <span className="chat-msg__citation">{msg.citation}</span>}
                  </div>
                </div>
              ))}
              {isAiTyping && (
                <div className="chat-msg chat-msg--ai">
                  <div className="chat-msg__bubble">
                    <div className="spinner"></div>
                  </div>
                </div>
              )}
            </div>
            <form className="chat-box__input-area" onSubmit={handleChatSubmit}>
              <input 
                type="text" 
                className="chat-input" 
                placeholder="Ask a medical question..."
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
              />
              <button type="submit" className="btn btn--primary btn--icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
