import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../api';

const navItems = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'patients', label: 'Patients' },
  { id: 'appointments', label: 'Appointments' },
  { id: 'xray', label: 'X-Ray AI' },
  { id: 'voice', label: 'Voice AI' },
  { id: 'guidelines', label: 'Guidelines' },
];

function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'U';
}

function formatAppointmentDate(value) {
  return new Date(value).toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function Header({ currentPage, onNavigate, user, onLogout, onSearchSelect, logoutError }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [notificationsError, setNotificationsError] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const searchRef = useRef(null);
  const notificationsRef = useRef(null);
  const profileRef = useRef(null);

  useEffect(() => {
    const query = searchTerm.trim();
    if (query.length < 2) return undefined;

    let active = true;
    const timer = window.setTimeout(() => {
      setSearchLoading(true);
      setSearchError('');
      Promise.all([
        apiRequest('/api/patients'),
        apiRequest('/api/appointments'),
      ])
        .then(([patients, appointments]) => {
          if (!active) return;
          const normalizedQuery = query.toLocaleLowerCase();
          setSearchResults({
            patients: patients.filter((patient) => [
              patient.fullName,
              patient.phone,
              patient.gender,
              patient.notes,
            ].some((value) => String(value || '').toLocaleLowerCase().includes(normalizedQuery))).slice(0, 5),
            appointments: appointments.filter((appointment) => [
              appointment.patientName,
              appointment.reason,
              appointment.location,
              appointment.status,
            ].some((value) => String(value || '').toLocaleLowerCase().includes(normalizedQuery))).slice(0, 5),
          });
        })
        .catch((error) => {
          if (!active) return;
          setSearchError(error.message || 'Could not search your records.');
          setSearchResults({ patients: [], appointments: [] });
        })
        .finally(() => {
          if (active) setSearchLoading(false);
        });
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [searchTerm]);

  useEffect(() => {
    let active = true;
    const loadNotifications = () => {
      setNotificationsLoading(true);
      apiRequest('/api/appointments')
        .then((appointments) => {
          if (!active) return;
          const now = Date.now();
          setNotifications(appointments.filter((appointment) => (
            appointment.status === 'scheduled'
            && new Date(appointment.scheduledAt).getTime() >= now
          )));
          setNotificationsError('');
        })
        .catch((error) => {
          if (active) setNotificationsError(error.message || 'Could not load upcoming appointments.');
        })
        .finally(() => {
          if (active) setNotificationsLoading(false);
        });
    };

    loadNotifications();
    const interval = window.setInterval(loadNotifications, 60_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [currentPage]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!searchRef.current?.contains(event.target)) setSearchOpen(false);
      if (!notificationsRef.current?.contains(event.target)) setNotificationsOpen(false);
      if (!profileRef.current?.contains(event.target)) setProfileOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setSearchOpen(false);
        setNotificationsOpen(false);
        setProfileOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const selectSearchResult = (page, query) => {
    setSearchOpen(false);
    setNotificationsOpen(false);
    onSearchSelect(page, query);
  };

  const upcomingCount = notifications.length;

  return (
    <header className="floating-header-wrapper">
      <div className="floating-header">
        <div className="floating-header__main">
          <button className="floating-header__brand" onClick={() => onNavigate('dashboard')} type="button" aria-label="EthioMed dashboard">
            <span className="floating-header__logo" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </span>
            <span className="floating-header__brand-text">
              <strong>EthioMed AI</strong>
              <small>Clinical support tools</small>
            </span>
          </button>

          <nav className="floating-header__nav" aria-label="Main navigation">
            {navItems.map((item) => (
              <button
                key={item.id}
                className={`floating-header__nav-link ${currentPage === item.id ? 'active' : ''}`}
                type="button"
                aria-current={currentPage === item.id ? 'page' : undefined}
                onClick={() => {
                  setSearchOpen(false);
                  onSearchSelect(item.id, '');
                }}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="floating-header__search-wrap" ref={searchRef}>
            <form
              className="floating-header__search"
              role="search"
              onSubmit={(event) => {
                event.preventDefault();
                if (searchTerm.trim()) selectSearchResult('patients', searchTerm.trim());
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="search"
                value={searchTerm}
                aria-label="Search patients and appointments"
                aria-expanded={searchOpen && searchTerm.trim().length >= 2}
                aria-controls="header-search-results"
                placeholder="Search patients, appointments…"
                onFocus={() => {
                  setNotificationsOpen(false);
                  setProfileOpen(false);
                  setSearchOpen(true);
                }}
                onChange={(event) => {
                  const value = event.target.value;
                  setNotificationsOpen(false);
                  setProfileOpen(false);
                  setSearchTerm(value);
                  if (value.trim().length < 2) {
                    setSearchResults(null);
                    setSearchError('');
                    setSearchLoading(false);
                  }
                  setSearchOpen(true);
                }}
              />
              {searchTerm && (
                <button className="header-search-clear" type="button" aria-label="Clear search" onClick={() => {
                  setSearchTerm('');
                  setSearchResults(null);
                  setSearchError('');
                  setSearchLoading(false);
                }}>
                  ×
                </button>
              )}
            </form>
            {searchOpen && searchTerm.trim().length >= 2 && (
              <div className="header-popover header-search-results" id="header-search-results">
                {searchLoading ? <p className="header-popover__message">Searching your records…</p> : null}
                {searchError ? <p className="header-popover__error" role="alert">{searchError}</p> : null}
                {!searchLoading && !searchError && searchResults && (
                  <>
                    {searchResults.patients.length > 0 && (
                      <section>
                        <h2>Patients</h2>
                        {searchResults.patients.map((patient) => (
                          <button
                            className="header-search-result"
                            key={`patient-${patient.id}`}
                            type="button"
                            onClick={() => selectSearchResult('patients', searchTerm.trim())}
                          >
                            <span className="header-result-icon">PT</span>
                            <span><strong>{patient.fullName}</strong><small>{patient.phone || 'Patient record'}</small></span>
                            <b aria-hidden="true">→</b>
                          </button>
                        ))}
                      </section>
                    )}
                    {searchResults.appointments.length > 0 && (
                      <section>
                        <h2>Appointments</h2>
                        {searchResults.appointments.map((appointment) => (
                          <button
                            className="header-search-result"
                            key={`appointment-${appointment.id}`}
                            type="button"
                            onClick={() => selectSearchResult('appointments', searchTerm.trim())}
                          >
                            <span className="header-result-icon header-result-icon--orange">◷</span>
                            <span><strong>{appointment.patientName}</strong><small>{appointment.reason} · {formatAppointmentDate(appointment.scheduledAt)}</small></span>
                            <b aria-hidden="true">→</b>
                          </button>
                        ))}
                      </section>
                    )}
                    {!searchResults.patients.length && !searchResults.appointments.length && (
                      <p className="header-popover__message">No matching patient or appointment records.</p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          <div className="floating-header__actions">
            <div className="header-action-anchor" ref={notificationsRef}>
              <button
                className={`header-icon-button ${notificationsOpen ? 'is-active' : ''}`}
                type="button"
                aria-label={`Upcoming appointments${upcomingCount ? ` (${upcomingCount})` : ''}`}
                aria-expanded={notificationsOpen}
                onClick={() => {
                  setNotificationsOpen((open) => !open);
                  setProfileOpen(false);
                  setSearchOpen(false);
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M10 21h4" />
                </svg>
                {upcomingCount > 0 && <span className="badge-count">{upcomingCount > 9 ? '9+' : upcomingCount}</span>}
              </button>
              {notificationsOpen && (
                <div className="header-popover header-notifications">
                  <div className="header-popover__heading">
                    <div><span>YOUR SCHEDULE</span><h2>Upcoming appointments</h2></div>
                    <span className="header-notification-count">{upcomingCount}</span>
                  </div>
                  {notificationsLoading ? <p className="header-popover__message">Loading appointments…</p> : null}
                  {notificationsError ? <p className="header-popover__error" role="alert">{notificationsError}</p> : null}
                  {!notificationsLoading && !notificationsError && notifications.length === 0 && (
                    <p className="header-popover__message">You have no upcoming scheduled appointments.</p>
                  )}
                  {!notificationsLoading && !notificationsError && notifications.slice(0, 5).map((appointment) => (
                    <button
                      className="header-notification-item"
                      key={appointment.id}
                      type="button"
                      onClick={() => {
                        setNotificationsOpen(false);
                        onSearchSelect('appointments', appointment.patientName);
                      }}
                    >
                      <span className="header-notification-item__date">{new Date(appointment.scheduledAt).getDate()}</span>
                      <span><strong>{appointment.patientName}</strong><small>{formatAppointmentDate(appointment.scheduledAt)}</small><small>{appointment.reason}</small></span>
                    </button>
                  ))}
                  {notifications.length > 5 && <p className="header-popover__footnote">Showing the next 5 of {notifications.length} appointments.</p>}
                  <button className="header-popover__all" type="button" onClick={() => { setNotificationsOpen(false); onSearchSelect('appointments', ''); }}>
                    View schedule <span aria-hidden="true">→</span>
                  </button>
                </div>
              )}
            </div>

            <div className="header-action-anchor" ref={profileRef}>
              <button
                className={`header-profile-button ${profileOpen || currentPage === 'profile' ? 'is-active' : ''}`}
                type="button"
                onClick={() => {
                  setSearchOpen(false);
                  setNotificationsOpen(false);
                  setProfileOpen((open) => !open);
                }}
                aria-label={`Account menu for ${user?.fullName || 'your account'}`}
                aria-expanded={profileOpen}
                aria-controls="header-profile-menu"
              >
                <span className="header-profile-avatar">{initials(user?.fullName)}</span>
                <span className="header-profile-name">{user?.fullName || 'My account'}</span>
                <span className="header-profile-chevron" aria-hidden="true">⌄</span>
              </button>
              {profileOpen && (
                <div className="header-popover header-profile-menu" id="header-profile-menu">
                  <div className="header-profile-menu__identity">
                    <span className="header-profile-avatar">{initials(user?.fullName)}</span>
                    <span>
                      <strong>{user?.fullName || 'EthioMed user'}</strong>
                      <small>{user?.email || 'Signed-in account'}</small>
                    </span>
                  </div>
                  <button
                    className="header-profile-menu__item"
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      onNavigate('profile');
                    }}
                  >
                    <span aria-hidden="true">◉</span> My profile
                  </button>
                  <button
                    className="header-profile-menu__item header-profile-menu__logout"
                    type="button"
                    onClick={async () => {
                      const loggedOut = await onLogout();
                      if (loggedOut) setProfileOpen(false);
                    }}
                  >
                    <span aria-hidden="true">↪</span> Log out
                  </button>
                  {logoutError && <p className="header-profile-menu__error" role="alert">{logoutError}</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
