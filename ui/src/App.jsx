import { useEffect, useState } from 'react';
import './App.css';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import XRayAnalysis from './components/XRayAnalysis';
import VoiceAssistant from './components/VoiceAssistant';
import Guidelines from './components/Guidelines';
import Footer from './components/Footer';
import Landing from './components/Landing';
import Patients from './components/Patients';
import Appointments from './components/Appointments';
import Profile from './components/Profile';
import { apiRequest } from './api';

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [user, setUser] = useState(null);
  const [logoutError, setLogoutError] = useState('');
  const googleAuth = new URLSearchParams(window.location.search).get('google_auth');
  const [googleAuthError, setGoogleAuthError] = useState(() => {
    if (!googleAuth || googleAuth === 'success') return '';
    if (googleAuth === 'client_config') {
      return 'Google rejected the OAuth client credentials. Check that the client ID and current client secret in api/.env belong to the same active Web application client, then restart the API.';
    }
    if (googleAuth === 'authorization') {
      return 'Google rejected the authorization code. Check that the Google OAuth redirect URI is exactly http://localhost:8000/api/auth/google/callback, then try again.';
    }
    return googleAuth === 'not_configured'
      ? 'Google sign-in needs a Google OAuth client ID, client secret, and session secret in the API environment. Set them up using api/README.md, then restart the API.'
      : 'Google sign-in failed. Please try again or use email and password.';
  });

  useEffect(() => {
    if (googleAuth) {
      window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
    }

    apiRequest('/api/auth/session')
      .then((data) => setUser(data.user))
      .catch((error) => {
        if (error.status === 401) return;
        console.error('Could not restore the signed-in session:', error);
        if (googleAuth === 'success') {
          setGoogleAuthError('Google sign-in completed, but the application could not load your session. Please try again.');
        }
      });
  }, [googleAuth]);

  const handleLogout = async () => {
    setLogoutError('');
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
      setUser(null);
      setCurrentPage('dashboard');
      return true;
    } catch (error) {
      console.error('Could not clear the signed-in session:', error);
      setLogoutError(error.message || 'Could not log out. Please try again.');
      return false;
    }
  };

  const handleSearchSelect = (page, query) => {
    setSearchQuery(query);
    setCurrentPage(page);
  };

  if (!user) {
    return (
      <Landing
        onLoginSuccess={(userData) => setUser(userData)}
        authError={googleAuthError}
        onClearAuthError={() => setGoogleAuthError('')}
      />
    );
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <Dashboard onNavigate={setCurrentPage} user={user} />;
      case 'xray': return <XRayAnalysis />;
      case 'voice': return <VoiceAssistant />;
      case 'guidelines': return <Guidelines />;
      case 'patients': return <Patients searchQuery={searchQuery} />;
      case 'appointments': return <Appointments searchQuery={searchQuery} />;
      case 'profile': return <Profile user={user} onLogout={handleLogout} logoutError={logoutError} />;
      default: return <Dashboard onNavigate={setCurrentPage} user={user} />;
    }
  };

  return (
    <div className="app">
      <Header 
        currentPage={currentPage} 
        onNavigate={setCurrentPage}
        onSearchSelect={handleSearchSelect}
        user={user}
        onLogout={handleLogout}
        logoutError={logoutError}
      />
      <main className="app__main">
        <div className="app__container">
          {renderPage()}
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default App;
