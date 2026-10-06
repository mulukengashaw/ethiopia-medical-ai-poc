import React, { useState } from 'react';
import { API_BASE_URL, apiRequest } from '../api';

export default function Auth({ onLoginSuccess, initialError = '', initialMode = 'login' }) {
  const [isLogin, setIsLogin] = useState(initialMode !== 'signup');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '', email: '', password: '', confirmPassword: ''
  });
  const [error, setError] = useState(initialError);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!isLogin && formData.password !== formData.confirmPassword) {
      setError('Passwords do not match'); return;
    }
    setLoading(true);
    const endpoint = isLogin ? '/api/login' : '/api/signup';
    try {
      const data = await apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      if (data.success) {
        if (isLogin) { onLoginSuccess(data.user); }
        else { setIsLogin(true); setFormData({ fullName: '', email: '', password: '', confirmPassword: '', phone: '' }); alert('Account created! Please log in.'); }
      } else { setError(data.message || 'Authentication failed'); }
    } catch { setError('Cannot connect to server. Make sure XAMPP & backend are running.'); }
    finally { setLoading(false); }
  };

  // ── shared styles ──
  const card = {
    width: '100%', maxWidth: '380px', margin: '0 auto',
    borderRadius: '16px', overflow: 'hidden',
    boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
    fontFamily: 'Inter,sans-serif',
    background: '#fff',
  };

  const inputWrap = {
    display: 'flex', alignItems: 'center',
    border: '1px solid #e5e7eb', borderRadius: '8px',
    padding: '0 10px', marginBottom: '8px', background: '#fafafa',
    transition: 'border-color 0.2s',
  };
  const inputStyle = {
    flex: 1, border: 'none', background: 'transparent',
    padding: '10px 0 10px 8px', fontSize: '13px', outline: 'none', color: '#333',
  };
  const iconStyle = { color: '#aaa', fontSize: '14px', flexShrink: 0 };
  const btnOrange = {
    width: '100%', padding: '12px', borderRadius: '8px',
    border: 'none', background: 'linear-gradient(135deg,#f97316,#ea580c)',
    color: '#fff', fontWeight: 700, fontSize: '14px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
    marginTop: '4px',
  };

  return (
    <div style={card}>

      {/* ── HERO ── */}
      <div style={{
        position: 'relative', height: '180px', overflow: 'hidden',
        background: 'linear-gradient(135deg,#1e3a5f 0%,#0f2440 100%)'
      }}>
        <img
          src="https://i.pinimg.com/736x/81/7b/8e/817b8e1d1d344b68e61c85e03fa1ce33.jpg"
          alt="Doctor"
          style={{
            position: 'absolute', bottom: 0, left: 0,
            height: '180px', width: '55%', objectFit: 'cover', objectPosition: 'top center',
            opacity: 0.85, borderRadius: '0'
          }}
        />
        {/* overlay gradient */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to right, transparent 30%, rgba(10,24,48,0.85) 100%)'
        }} />

        {/* Brand */}
        <div style={{
          position: 'absolute', top: '20px', left: '50%',
          transform: 'translateX(-50%)', textAlign: 'center', zIndex: 2
        }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '12px',
            background: 'linear-gradient(135deg,#f97316,#ea580c)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px'
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" width="22" height="22">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <div style={{ fontWeight: 800, fontSize: '18px', color: '#fff' }}>EthioMed AI</div>
          <div style={{ fontSize: '11px', color: '#f97316', fontWeight: 600 }}>Clinical Support Tools</div>
        </div>

        {/* AI badge */}
        <div style={{
          position: 'absolute', bottom: '14px', right: '16px', zIndex: 2,
          background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: '10px', padding: '8px 12px', textAlign: 'center'
        }}>
          <div style={{ fontSize: '10px', color: '#cde', marginBottom: '2px' }}>X-Ray Research Screen</div>
          <div style={{ fontSize: '14px', fontWeight: 800, color: '#fff', lineHeight: 1.3 }}>Clinician review</div>
          <div style={{ fontSize: '10px', color: '#cde' }}>Not a diagnosis</div>
        </div>

        {/* Tagline */}
        {!isLogin && (
          <div style={{
            position: 'absolute', bottom: '14px', left: '16px', zIndex: 2
          }}>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: '13px', lineHeight: 1.4 }}>
              Create Your Account
            </div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px' }}>
              Research screening · clinician review
            </div>
          </div>
        )}
      </div>

      {/* ── Steps (signup only) ── */}
      {!isLogin && (
        <div style={{
          display: 'flex', justifyContent: 'center', gap: '12px',
          padding: '14px 20px 0', alignItems: 'center'
        }}>
          {[
            { num: 1, label: 'Create Account', done: true },
            { num: 2, label: 'Verify Information', done: false },
            { num: 3, label: 'Start Diagnosing', done: false },
          ].map((s, i) => (
            <React.Fragment key={s.num}>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  background: s.done ? '#f97316' : i === 1 ? '#6366f1' : '#8b5cf6',
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: '13px', margin: '0 auto 4px'
                }}>
                  {s.done ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" width="14" height="14">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" width="14" height="14">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                    </svg>
                  )}
                </div>
                <div style={{ fontSize: '10px', color: '#666', maxWidth: '60px', lineHeight: 1.3 }}>{s.label}</div>
              </div>
              {i < 2 && <div style={{ flex: 1, height: '1.5px', background: '#e5e7eb', marginBottom: '20px' }} />}
            </React.Fragment>
          ))}
        </div>
      )}

      {/* ── BODY ── */}
      <div style={{ padding: '12px 18px 18px' }}>

        {/* Tab switcher */}
        <div style={{
          display: 'flex', background: '#f3f4f6', borderRadius: '12px',
          padding: '4px', marginBottom: '20px'
        }}>
          {['Login', 'Sign Up'].map((tab) => (
            <button key={tab} onClick={() => { setIsLogin(tab === 'Login'); setError(''); }}
              style={{
                flex: 1, padding: '10px', borderRadius: '9px', border: 'none',
                fontWeight: 700, fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s',
                background: (tab === 'Login') === isLogin ? '#f97316' : 'transparent',
                color: (tab === 'Login') === isLogin ? '#fff' : '#666',
              }}>
              {tab}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626',
            padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '14px'
          }}>{error}</div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Signup: Full Name */}
          {!isLogin && (
            <div style={inputWrap}>
              <span style={iconStyle}>👤</span>
              <input style={inputStyle} type="text" name="fullName"
                placeholder="Full Name" value={formData.fullName}
                onChange={handleChange} required />
            </div>
          )}



          {/* Email (optional for signup, required for login) */}
          <div style={inputWrap}>
            <span style={iconStyle}>✉️</span>
            <input style={inputStyle} type="email" name="email"
              placeholder="Email Address"
              value={formData.email} onChange={handleChange}
              required />
          </div>

          {/* Password */}
          <div style={inputWrap}>
            <span style={iconStyle}>🔒</span>
            <input style={inputStyle} type={showPassword ? 'text' : 'password'}
              name="password" placeholder="Password"
              value={formData.password} onChange={handleChange} required />
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '16px' }}>
              {showPassword ? '🙈' : '👁️'}
            </button>
          </div>

          {/* Confirm Password (signup) */}
          {!isLogin && (
            <div style={inputWrap}>
              <span style={iconStyle}>🔐</span>
              <input style={inputStyle} type={showConfirm ? 'text' : 'password'}
                name="confirmPassword" placeholder="Confirm Password"
                value={formData.confirmPassword} onChange={handleChange} required />
              <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '16px' }}>
                {showConfirm ? '🙈' : '👁️'}
              </button>
            </div>
          )}

          {/* Login: remember me + forgot */}
          {isLogin && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#555', cursor: 'pointer' }}>
                <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)}
                  style={{ accentColor: '#f97316', width: '15px', height: '15px' }} />
                Remember me
              </label>
              <button type="button" style={{ background: 'none', border: 'none', color: '#f97316', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                Forgot Password?
              </button>
            </div>
          )}

          {/* Signup: terms */}
          {!isLogin && (
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px', color: '#555', marginBottom: '14px', cursor: 'pointer' }}>
              <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
                required style={{ accentColor: '#f97316', width: '14px', height: '14px', marginTop: '2px', flexShrink: 0 }} />
              <span>
                I agree to the{' '}
                <span style={{ color: '#f97316', fontWeight: 600 }}>Terms of Service</span> and{' '}
                <span style={{ color: '#f97316', fontWeight: 600 }}>Privacy Policy</span>
              </span>
            </label>
          )}

          {/* Submit */}
          <button type="submit" style={btnOrange} disabled={loading}>
            {loading ? '⏳ Processing...' : isLogin ? 'Login →' : 'Create Account →'}
          </button>
        </form>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '18px 0 14px' }}>
          <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }} />
          <span style={{ fontSize: '12px', color: '#aaa' }}>or {isLogin ? 'continue' : 'sign up'} with</span>
          <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }} />
        </div>

        <button
          type="button"
          onClick={() => {
            window.location.assign(`${API_BASE_URL}/api/auth/google`);
          }}
          style={{
            width: '100%', padding: '12px', borderRadius: '8px',
            border: '1.5px solid #e5e7eb', background: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '10px', cursor: 'pointer', color: '#333', fontWeight: 600,
            fontSize: '14px', marginBottom: '18px',
          }}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        {/* Toggle link */}
        <p style={{ textAlign: 'center', fontSize: '13px', color: '#666', margin: 0 }}>
          {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button onClick={() => { setIsLogin(!isLogin); setError(''); }}
            style={{ background: 'none', border: 'none', color: '#f97316', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}>
            {isLogin ? 'Sign Up' : 'Login'}
          </button>
        </p>
      </div>
    </div>
  );
}
