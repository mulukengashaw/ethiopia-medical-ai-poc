const dashboardCards = [
  {
    id: 'patients',
    number: '01',
    icon: '👥',
    eyebrow: 'PATIENT RECORDS',
    title: 'Your patients',
    description: 'View private patient details, saved X-rays, reports, and clinician-entered plans.',
    action: 'Open patient records',
    tone: 'teal',
  },
  {
    id: 'appointments',
    number: '02',
    icon: '📅',
    eyebrow: 'CARE COORDINATION',
    title: 'Appointments',
    description: 'Schedule visits, update appointment status, and keep care plans organized.',
    action: 'Manage appointments',
    tone: 'orange',
  },
  {
    id: 'xray',
    number: '03',
    icon: '🩻',
    eyebrow: 'RESEARCH SUPPORT',
    title: 'Chest X-ray review',
    description: 'Save an image to a patient record and view a research-only flag for clinician review.',
    action: 'Open X-ray review',
    tone: 'navy',
  },
  {
    id: 'guidelines',
    number: '04',
    icon: '📖',
    eyebrow: 'LOCAL REFERENCE',
    title: 'Ethiopian guidelines',
    description: 'Search local guideline passages and check cited pages with the patient’s full context.',
    action: 'Browse guidelines',
    tone: 'gold',
  },
];

export default function Dashboard({ onNavigate, user }) {
  const firstName = user?.fullName?.trim().split(/\s+/)[0];

  return (
    <div className="dashboard-home">
      <section className="dashboard-welcome">
        <div className="dashboard-welcome__content">
          <span className="dashboard-welcome__badge">
            <span /> CLINICIAN-LED · PATIENT-CENTRED
          </span>
          <h1>
            {firstName ? `Welcome, ${firstName}.` : 'Welcome to your workspace.'}
            <br />
            <span>Care, organized.</span>
          </h1>
          <p>
            One secure workspace for patient records, appointments, X-ray research screening,
            and local clinical references.
          </p>
          <div className="dashboard-welcome__actions">
            <button type="button" onClick={() => onNavigate('patients')}>
              View patients <span aria-hidden="true">→</span>
            </button>
            <button type="button" onClick={() => onNavigate('xray')}>
              Start X-ray review
            </button>
          </div>
        </div>
        <div className="dashboard-welcome__art" aria-hidden="true">
          <span className="dashboard-welcome__orbit dashboard-welcome__orbit--one" />
          <span className="dashboard-welcome__orbit dashboard-welcome__orbit--two" />
          <span className="dashboard-welcome__medical-icon">🩺</span>
          <span className="dashboard-welcome__art-card">
            <b>People first</b>
            <span>Clinical judgement always</span>
          </span>
        </div>
      </section>

      <section className="dashboard-principles" aria-label="Workspace principles">
        <article>
          <span className="dashboard-principle-icon dashboard-principle-icon--teal">🔒</span>
          <div><strong>Private records</strong><span>Scoped to your account</span></div>
        </article>
        <article>
          <span className="dashboard-principle-icon dashboard-principle-icon--orange">🧪</span>
          <div><strong>Research screening</strong><span>Not a diagnosis</span></div>
        </article>
        <article>
          <span className="dashboard-principle-icon dashboard-principle-icon--navy">👩‍⚕️</span>
          <div><strong>Human review</strong><span>Clinician-led decisions</span></div>
        </article>
      </section>

      <section className="dashboard-services">
        <header className="dashboard-section-heading">
          <div>
            <span>YOUR WORKSPACE</span>
            <h2>What would you like to do?</h2>
          </div>
          <p>Choose a service to continue.</p>
        </header>

        <div className="dashboard-service-grid">
          {dashboardCards.map((card) => (
            <button
              className={`dashboard-service-card dashboard-service-card--${card.tone}`}
              key={card.id}
              type="button"
              onClick={() => onNavigate(card.id)}
            >
              <span className="dashboard-service-card__top">
                <span className="dashboard-service-card__icon" aria-hidden="true">{card.icon}</span>
                <span className="dashboard-service-card__number">{card.number}</span>
              </span>
              <span className="dashboard-service-card__eyebrow">{card.eyebrow}</span>
              <span className="dashboard-service-card__title">{card.title}</span>
              <span className="dashboard-service-card__description">{card.description}</span>
              <span className="dashboard-service-card__action">{card.action} <span aria-hidden="true">→</span></span>
            </button>
          ))}
        </div>
      </section>

      <aside className="dashboard-clinical-note">
        <span aria-hidden="true">✦</span>
        <p>
          <strong>Clinical safety reminder</strong>
          X-ray screening is for research support only. It cannot confirm or rule out TB, and must not be used to choose treatment.
          A qualified clinician should review each patient’s complete clinical picture.
        </p>
        <button type="button" onClick={() => onNavigate('xray')}>X-ray review</button>
      </aside>
    </div>
  );
}
