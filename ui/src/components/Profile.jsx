export default function Profile({ user, onLogout, logoutError }) {
  const initials = user?.fullName
    ?.trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'U';

  return (
    <section className="profile-page">
      <header className="profile-page__heading">
        <span>ACCOUNT SETTINGS</span>
        <h1>Your profile</h1>
        <p>Review the account currently signed in to this private workspace.</p>
      </header>

      <article className="profile-card">
        <div className="profile-card__banner" />
        <div className="profile-card__identity">
          <span className="profile-card__avatar">{initials}</span>
          <div>
            <h2>{user?.fullName || 'EthioMed user'}</h2>
            <p>{user?.email || 'Email address unavailable'}</p>
          </div>
        </div>
        <div className="profile-card__details">
          <div><span>Full name</span><strong>{user?.fullName || 'Not provided'}</strong></div>
          <div><span>Email address</span><strong>{user?.email || 'Not provided'}</strong></div>
          <div><span>Account ID</span><strong>{user?.id ?? '—'}</strong></div>
          <div><span>Workspace access</span><strong>Signed-in staff account</strong></div>
        </div>
        <div className="profile-card__privacy">
          <span aria-hidden="true">🔒</span>
          <p><strong>Private workspace</strong>Your patient records and appointments are scoped to your signed-in account.</p>
        </div>
        {logoutError && <p className="profile-card__error" role="alert">{logoutError}</p>}
        <div className="profile-card__actions">
          <button type="button" className="profile-card__signout" onClick={onLogout}>Log out of EthioMed</button>
        </div>
      </article>
    </section>
  );
}
