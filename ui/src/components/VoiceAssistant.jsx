import React, { useState } from 'react';

export default function VoiceAssistant() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState(null);
  
  const handleToggleRecord = async () => {
    if (isRecording) {
      setIsRecording(false);
      setIsProcessing(true);
      
      try {
        const response = await fetch('http://localhost:8000/api/analyze-voice', {
          method: 'POST',
        });
        
        if (!response.ok) throw new Error("API failed");
        
        const data = await response.json();
        setResult(data);
      } catch (err) {
        console.error(err);
        setResult({
          transcript_am: "ስህተት አጋጥሟል (Error)",
          transcript_en: "Failed to connect to backend. Please start main.py.",
          symptoms: ["Connection Error"]
        });
      } finally {
        setIsProcessing(false);
      }
    } else {
      setIsRecording(true);
      setResult(null);
    }
  };

  return (
    <div className="voice-assistant">
      <header className="voice-assistant__header">
        <h1 className="voice-assistant__title">Amharic Voice Assistant</h1>
        <h2 className="voice-assistant__subtitle">የአማርኛ ድምፅ ረዳት</h2>
      </header>

      <div className="voice-assistant__status">
        <span className={`status-badge ${isRecording ? 'status-badge--recording' : isProcessing ? 'status-badge--processing' : 'status-badge--ready'}`}>
          {isRecording ? 'Listening...' : isProcessing ? 'Processing...' : 'Ready'}
        </span>
      </div>

      <div className="voice-assistant__controls">
        <div className="waveform">
          {[...Array(20)].map((_, i) => (
            <div 
              key={i} 
              className={`waveform__bar ${isRecording ? 'waveform__bar--active' : ''}`}
              style={{ animationDelay: `${i * 0.05}s` }}
            ></div>
          ))}
        </div>

        <button 
          className={`record-btn ${isRecording ? 'record-btn--recording' : ''} ${isProcessing ? 'record-btn--processing' : ''}`}
          onClick={handleToggleRecord}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <div className="spinner"></div>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          )}
          {isRecording && <div className="record-btn__pulse"></div>}
        </button>
      </div>

      {result && (
        <div className="voice-assistant__results">
          <div className="card transcript-card">
            <h3 className="card__title">Amharic Transcript</h3>
            <p className="transcript-card__text transcript-card__text--am">{result.transcript_am}</p>
          </div>
          
          <div className="card translation-card">
            <h3 className="card__title">English Translation</h3>
            <p className="transcript-card__text">{result.transcript_en}</p>
          </div>

          <div className="symptoms-section">
            <h3 className="symptoms-section__title">Detected Symptoms</h3>
            <div className="tags">
              {result.symptoms.map((symp, i) => (
                <span key={i} className="tag tag--warning">{symp}</span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
