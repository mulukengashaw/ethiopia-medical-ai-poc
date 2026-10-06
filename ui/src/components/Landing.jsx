import React, { useState } from 'react';
import Auth from './Auth';

const serviceImages = {
  xray: 'https://i.pinimg.com/236x/7d/23/2e/7d232e3a20c1279b6516dc80a13014b7.jpg',
  voice: 'https://i.pinimg.com/1200x/ea/3e/11/ea3e11012eb73493c5fe0e8e54e036fe.jpg',
  guidelines: 'https://i.pinimg.com/1200x/ef/45/01/ef4501f0164be7702f3a28123edc3ea9.jpg',
  patients: 'https://i.pinimg.com/736x/8b/3a/be/8b3abe5e24497c5dfacf1dfabb9ea3d9.jpg',
};

export default function Landing({
  onLoginSuccess,
  authError = '',
  onClearAuthError = () => {},
}) {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const isAuthModalVisible = showAuthModal || Boolean(authError);

  const openAuth = (mode = 'login') => {
    setAuthMode(mode);
    setShowAuthModal(true);
    onClearAuthError();
  };

  const closeAuth = () => {
    setShowAuthModal(false);
    onClearAuthError();
  };

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', background: '#fff', color: '#1a1a2e', overflowX: 'hidden' }}>

      {/* ── HEADER ── */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
        background: '#fff', borderBottom: '1px solid #f0f0f0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 40px', height: '64px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)'
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '8px',
            background: 'linear-gradient(135deg,#f97316,#ea580c)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" width="20" height="20">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '16px', lineHeight: 1 }}>EthioMed AI</div>
            <div style={{ fontSize: '10px', color: '#f97316', lineHeight: 1 }}>Clinical Support Tools</div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ display: 'flex', gap: '28px', alignItems: 'center' }}>
          {['Home','X-Ray AI','Voice AI','Guidelines','About','Contact'].map((item, i) => (
            <a key={item} href={`#${item.toLowerCase().replace(' ','-')}`}
              style={{
                textDecoration: 'none', fontSize: '14px', fontWeight: i === 0 ? 600 : 400,
                color: i === 0 ? '#f97316' : '#444',
                borderBottom: i === 0 ? '2px solid #f97316' : 'none',
                paddingBottom: '2px'
              }}>{item}</a>
          ))}
        </nav>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" width="20" height="20" style={{ cursor: 'pointer' }}>
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <button onClick={() => openAuth('login')} style={{
            padding: '8px 20px', borderRadius: '6px', border: '1.5px solid #f97316',
            background: 'transparent', color: '#f97316', fontWeight: 600,
            fontSize: '14px', cursor: 'pointer'
          }}>Sign In</button>
          <button onClick={() => openAuth('signup')} style={{
            padding: '8px 20px', borderRadius: '6px', border: 'none',
            background: '#f97316', color: '#fff', fontWeight: 600,
            fontSize: '14px', cursor: 'pointer'
          }}>Get Started</button>
        </div>
      </header>

      {/* ── HERO ── */}
      <section id="home" style={{
        marginTop: '64px',
        background: 'linear-gradient(135deg, #fff7ed 0%, #fff 60%, #eff6ff 100%)',
        padding: '80px 80px 60px',
        display: 'flex', alignItems: 'center', gap: '60px',
        minHeight: '520px', position: 'relative', overflow: 'hidden'
      }}>
        {/* Left text */}
        <div style={{ flex: 1, zIndex: 2 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            background: '#fff', border: '1px solid #fed7aa', borderRadius: '20px',
            padding: '6px 14px', fontSize: '12px', fontWeight: 600,
            color: '#f97316', marginBottom: '20px'
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f97316', display: 'inline-block' }} />
            RESEARCH SCREENING · CLINICIAN REVIEW
          </div>
          <h1 style={{ fontSize: '48px', fontWeight: 800, lineHeight: 1.15, margin: '0 0 16px', color: '#1a1a2e' }}>
            Chest X-ray screening<br/>
            with <span style={{ color: '#f97316' }}>clinical review</span>
          </h1>
          <p style={{ fontSize: '15px', color: '#555', maxWidth: '420px', lineHeight: 1.7, marginBottom: '32px' }}>
            Keep a chest X-ray, patient record, and clinician review together. A local research model can flag images for review—it cannot diagnose tuberculosis.
          </p>
          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: '32px' }}>
            <button onClick={() => openAuth('signup')} style={{
              padding: '13px 28px', borderRadius: '8px', border: 'none',
              background: '#f97316', color: '#fff', fontWeight: 700,
              fontSize: '15px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '8px'
            }}>Get Started Now →</button>
            <button style={{
              padding: '13px 24px', borderRadius: '8px', border: '1.5px solid #ddd',
              background: '#fff', color: '#333', fontWeight: 600,
              fontSize: '15px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '8px'
            }}>
              <span style={{ fontSize: '18px' }}>▶</span> Watch Demo
            </button>
          </div>
          <div style={{ display: 'flex', gap: '28px', flexWrap: 'wrap' }}>
            {[
              { icon: '🧪', label: 'Research only', sub: 'Not a diagnosis' },
              { icon: '👩‍⚕️', label: 'Clinician-led', sub: 'Review every result' },
              { icon: '🗂️', label: 'Patient-linked', sub: 'Private records' }
            ].map(b => (
              <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '22px' }}>{b.icon}</span>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#333' }}>{b.label}</div>
                  <div style={{ fontSize: '11px', color: '#888' }}>{b.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: hero image + floating cards */}
        <div style={{ flex: 1, position: 'relative', minHeight: '400px', zIndex: 2 }}>
          {/* Doctor image */}
          <div style={{
            width: '100%', height: '420px', borderRadius: '20px',
            position: 'relative', overflow: 'hidden',
            boxShadow: '0 16px 48px rgba(249,115,22,0.2)'
          }}>
            <img
              src="https://i.pinimg.com/736x/81/7b/8e/817b8e1d1d344b68e61c85e03fa1ce33.jpg"
              alt="Medical professional"
              style={{
                width: '100%', height: '100%',
                objectFit: 'cover', objectPosition: 'top center',
                borderRadius: '20px'
              }}
            />
            {/* Research screening card */}
            <div style={{
              position: 'absolute', top: '20px', right: '20px',
              background: '#fff', borderRadius: '12px', padding: '12px 16px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: '160px'
            }}>
              <div style={{ fontSize: '11px', color: '#0f766e', fontWeight: 700, marginBottom: '5px' }}>RESEARCH SCREEN</div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#17324d' }}>Clinician review</div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>A flag is not a diagnosis</div>
            </div>
            {/* Voice card */}
            <div style={{
              position: 'absolute', bottom: '20px', right: '20px',
              background: '#fff', borderRadius: '12px', padding: '12px 16px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: '160px'
            }}>
              <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>
                🎙️ አምሃርኛ የድምፅ ምርመራ
              </div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#333' }}>Voice Analysis</div>
              <div style={{ display: 'flex', gap: '3px', marginTop: '8px', alignItems: 'flex-end' }}>
                {[12,20,8,25,14,22,10,18,16,24].map((h,i) => (
                  <div key={i} style={{ width: '8px', height: `${h}px`, background: '#f97316', borderRadius: '2px' }} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Decorative blob */}
        <div style={{
          position: 'absolute', top: '-100px', right: '-100px',
          width: '400px', height: '400px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(249,115,22,0.08), transparent)',
          zIndex: 1
        }} />
      </section>

      {/* ── X-RAY RESULT EXPLANATION ── */}
      <section id="x-ray-ai" className="landing-xray-guidance">
        <div className="landing-xray-guidance__icon" aria-hidden="true">🫁</div>
        <div className="landing-xray-guidance__content">
          <span className="landing-xray-guidance__eyebrow">A CLEAR, PATIENT-FIRST MESSAGE</span>
          <h2>A screening flag is a reason to check—not a TB diagnosis.</h2>
          <p>
            The research model cannot tell someone that they are infected. If an image is flagged, a clinician should review it
            and decide whether additional tests are appropriate.
          </p>
          <blockquote>
            “Your chest X-ray screening showed a pattern that needs further review for possible TB. This screening cannot confirm
            tuberculosis. A clinician will review your image and discuss whether more tests are appropriate. Please do not start
            treatment based on this result.”
          </blockquote>
        </div>
        <div className="landing-xray-guidance__badge">
          <span>✓</span>
          Clear, calm<br />next steps
        </div>
      </section>

      {/* ── FEATURE CARDS ── */}
      <section id="features" style={{ padding: '60px 80px', background: '#fff' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '20px' }}>
          {[
            { image: serviceImages.xray, title: 'X-Ray Review', desc: 'Save chest X-rays and view research-only flags for clinician review.', cta: 'Learn About X-Ray Review', ctaColor: '#f97316' },
            { image: serviceImages.voice, title: 'Voice Assistant', desc: 'Analyze symptoms from Amharic speech.', cta: 'Try Now', ctaColor: '#10b981' },
            { image: serviceImages.guidelines, title: 'Clinical Guidelines', desc: 'Access medical protocols and treatment guidelines.', cta: 'View Guidelines', ctaColor: '#8b5cf6' },
            { image: serviceImages.patients, title: 'Patient Management', desc: 'Manage patients and diagnostic history.', cta: 'Learn More', ctaColor: '#f97316' }
          ].map(f => (
            <div key={f.title} style={{
              background: '#fff', borderRadius: '14px', padding: '24px',
              border: '1px solid #f0f0f0', boxShadow: '0 4px 16px rgba(0,0,0,0.05)',
              transition: 'transform 0.2s', cursor: 'pointer'
            }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <img
                src={f.image}
                alt=""
                loading="lazy"
                style={{
                width: '52px', height: '52px', borderRadius: '12px',
                objectFit: 'cover', display: 'block', marginBottom: '16px'
              }} />
              <h3 style={{ fontWeight: 700, fontSize: '16px', margin: '0 0 8px', color: '#1a1a2e' }}>{f.title}</h3>
              <p style={{ fontSize: '13px', color: '#666', lineHeight: 1.6, margin: '0 0 16px' }}>{f.desc}</p>
              <a href={f.title === 'X-Ray Review' ? '#x-ray-ai' : '#features'} style={{ color: f.ctaColor, fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}>{f.cta} →</a>
            </div>
          ))}
        </div>
      </section>

      {/* ── STATS / COMPREHENSIVE ── */}
      <section style={{ padding: '50px 80px', background: '#fafafa', borderTop: '1px solid #f0f0f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '60px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 320px' }}>
            <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#1a1a2e', marginBottom: '12px' }}>
              Comprehensive AI Diagnostics
            </h2>
            <p style={{ color: '#666', lineHeight: 1.7, fontSize: '14px', maxWidth: '380px' }}>
              Practical tools to organize patient information and support—not replace—clinical judgment.
            </p>
          </div>
          <div style={{ flex: '1 1 400px', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '20px' }}>
            {[
              { val: 'Local', label: 'Research screening', trend: 'Not diagnostic', trendColor: '#0f766e' },
              { val: 'Private', label: 'Patient records', trend: 'Account-scoped', trendColor: '#0f766e' },
              { val: 'Human', label: 'Clinical review', trend: 'Always required', trendColor: '#0f766e' },
              { val: 'Source', label: 'Guideline search', trend: 'Review citations', trendColor: '#0f766e' }
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '28px', fontWeight: 800, color: '#1a1a2e' }}>{s.val}</div>
                <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>{s.label}</div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: s.trendColor }}>{s.trend}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── OUR SERVICES ── */}
      <section id="services" style={{ padding: '60px 80px', background: '#fff' }}>
        <h2 style={{ fontSize: '26px', fontWeight: 800, color: '#1a1a2e', marginBottom: '24px' }}>Our Services</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '20px' }}>
          {[
            { image: serviceImages.xray, title: 'Chest X-Ray Review', desc: 'Patient-linked image storage and a research-only signal for clinician review.', cta: 'Start Review' },
            { image: serviceImages.voice, title: 'Amharic Voice Assistant', desc: 'Extract symptoms from Amharic speech using NLP.', cta: 'Try Voice AI' },
            { image: serviceImages.guidelines, title: 'Clinical Guidelines', desc: 'Access evidence-based medical protocols and treatment recommendations.', cta: 'View Guidelines' },
            { image: serviceImages.patients, title: 'Patient Management', desc: 'Keep patient records and saved clinical history organized in one private workspace.', cta: 'Manage Patients' }
          ].map(s => (
            <div key={s.title} style={{
              borderRadius: '16px', overflow: 'hidden',
              boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
              transition: 'transform 0.2s', cursor: 'pointer'
            }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <img
                src={s.image}
                alt=""
                loading="lazy"
                style={{ display: 'block', width: '100%', height: '160px', objectFit: 'cover' }}
              />
              <div style={{ padding: '20px' }}>
                <h3 style={{ fontWeight: 700, fontSize: '16px', marginBottom: '8px', color: '#1a1a2e' }}>{s.title}</h3>
                <p style={{ fontSize: '13px', color: '#666', lineHeight: 1.6, marginBottom: '16px' }}>{s.desc}</p>
                <button onClick={() => openAuth('signup')} style={{
                  padding: '9px 20px', borderRadius: '7px', border: 'none',
                  background: '#f97316', color: '#fff', fontWeight: 600,
                  fontSize: '13px', cursor: 'pointer'
                }}>{s.cta} →</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{ padding: '60px 80px', background: '#fafafa', borderTop: '1px solid #f0f0f0' }}>
        <h2 style={{ fontSize: '26px', fontWeight: 800, color: '#1a1a2e', marginBottom: '32px' }}>How It Works</h2>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0', flexWrap: 'wrap' }}>
          {[
            { num: '1', icon: '📤', title: 'Choose patient', desc: 'Add an image or a report to the correct patient record.' },
            { num: '2', icon: '🧪', title: 'Research screen', desc: 'A local model may flag an image for additional review.' },
            { num: '3', icon: '👩‍⚕️', title: 'Clinician reviews', desc: 'A qualified clinician interprets findings and decides next steps.' }
          ].map((step, i) => (
            <React.Fragment key={step.num}>
              <div style={{ flex: 1, minWidth: '200px', textAlign: 'left' }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '50%',
                  background: '#f97316', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: '18px', marginBottom: '16px'
                }}>{step.num}</div>
                <div style={{ fontSize: '30px', marginBottom: '12px' }}>{step.icon}</div>
                <h3 style={{ fontWeight: 700, fontSize: '16px', marginBottom: '8px', color: '#1a1a2e' }}>{step.title}</h3>
                <p style={{ fontSize: '13px', color: '#666', lineHeight: 1.6 }}>{step.desc}</p>
              </div>
              {i < 2 && (
                <div style={{ display: 'flex', alignItems: 'center', padding: '22px 16px 0' }}>
                  <div style={{ width: '60px', height: '2px', background: '#fed7aa', position: 'relative' }}>
                    <div style={{ position: 'absolute', right: '-6px', top: '-4px', color: '#f97316', fontSize: '14px' }}>→</div>
                  </div>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </section>

      {/* ── CTA FOOTER BANNER ── */}
      <section style={{
        padding: '60px 80px',
        background: 'linear-gradient(135deg,#c2410c 0%,#f97316 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '30px'
      }}>
        <div>
          <h2 style={{ fontSize: '26px', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>
            Support thoughtful, clinician-led care
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '14px' }}>
            Organize patient records and support careful clinical review.
          </p>
          <div style={{ display: 'flex', gap: '14px', marginTop: '20px', flexWrap: 'wrap' }}>
            <button onClick={() => openAuth('signup')} style={{
              padding: '12px 26px', borderRadius: '8px', border: '2px solid #fff',
              background: '#fff', color: '#f97316', fontWeight: 700,
              fontSize: '14px', cursor: 'pointer'
            }}>Get Started Now →</button>
            <button onClick={() => openAuth('login')} style={{
              padding: '12px 26px', borderRadius: '8px', border: '2px solid rgba(255,255,255,0.5)',
              background: 'transparent', color: '#fff', fontWeight: 600,
              fontSize: '14px', cursor: 'pointer'
            }}>Contact Us</button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
          {[
            { icon: '🧪', label: 'Research-only screening' },
            { icon: '👩‍⚕️', label: 'Clinician review' },
            { icon: '🗂️', label: 'Patient-linked records' },
            { icon: '📖', label: 'Local guidelines' }
          ].map(i => (
            <div key={i.label} style={{ textAlign: 'center', color: '#fff' }}>
              <div style={{ fontSize: '28px', marginBottom: '6px' }}>{i.icon}</div>
              <div style={{ fontSize: '12px', fontWeight: 600, opacity: 0.9 }}>{i.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ textAlign: 'center', padding: '20px', background: '#1a1a2e', color: '#888', fontSize: '13px' }}>
        🇪🇹 EthioMed AI Research Platform © 2026 — FOR RESEARCH USE ONLY
      </footer>

      {/* ── AUTH MODAL ── */}
      {isAuthModalVisible && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px', overflowY: 'auto'
        }}>
          {/* Backdrop click to close */}
          <div onClick={closeAuth}
            style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
          <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '440px' }}>
            {/* Close button */}
            <button onClick={closeAuth} style={{
              position: 'absolute', top: '-12px', right: '-12px',
              width: '32px', height: '32px', borderRadius: '50%',
              background: '#fff', border: 'none', cursor: 'pointer',
              fontSize: '16px', display: 'flex', alignItems: 'center',
              justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              zIndex: 2
            }}>✕</button>
            <Auth
              onLoginSuccess={onLoginSuccess}
              initialError={authError}
              initialMode={authMode}
            />
          </div>
        </div>
      )}
    </div>
  );
}
