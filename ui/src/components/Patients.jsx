import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL, apiRequest } from '../api';

const emptyForm = {
  fullName: '',
  phone: '',
  dateOfBirth: '',
  gender: '',
  notes: '',
};

const fieldStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid var(--color-neutral-200)',
  boxSizing: 'border-box',
  font: 'inherit',
};

const fetchPatients = () => apiRequest('/api/patients');

function formatAge(dateOfBirth) {
  if (!dateOfBirth) return '—';
  const birth = new Date(`${dateOfBirth}T00:00:00`);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (
    today.getMonth() < birth.getMonth()
    || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
  ) {
    age -= 1;
  }
  return age >= 0 ? `${age}` : '—';
}

function formatDate(value) {
  return value
    ? new Date(`${value}T00:00:00`).toLocaleDateString()
    : 'No completed visits';
}

export default function Patients({ searchQuery = '' }) {
  const [patients, setPatients] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [clinicalHistory, setClinicalHistory] = useState([]);
  const [xrayHistory, setXrayHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
  const visiblePatients = normalizedQuery
    ? patients.filter((patient) => [
      patient.fullName,
      patient.phone,
      patient.gender,
      patient.notes,
    ].some((value) => String(value || '').toLocaleLowerCase().includes(normalizedQuery)))
    : patients;

  const loadPatients = useCallback(async () => {
    setLoading(true);
    try {
      setPatients(await fetchPatients());
      setError('');
    } catch (requestError) {
      setError(requestError.message || 'Could not load patient records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    fetchPatients()
      .then((rows) => {
        if (mounted) setPatients(rows);
      })
      .catch((requestError) => {
        if (mounted) setError(requestError.message || 'Could not load patient records.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  const openNewPatient = () => {
    setForm(emptyForm);
    setEditingId(null);
    setError('');
    setFormOpen(true);
  };

  const editPatient = (patient) => {
    setForm({
      fullName: patient.fullName || '',
      phone: patient.phone || '',
      dateOfBirth: patient.dateOfBirth || '',
      gender: patient.gender || '',
      notes: patient.notes || '',
    });
    setEditingId(patient.id);
    setError('');
    setFormOpen(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    const payload = {
      ...form,
      phone: form.phone.trim() || null,
      dateOfBirth: form.dateOfBirth || null,
      gender: form.gender.trim() || null,
      notes: form.notes.trim() || null,
    };

    try {
      await apiRequest(
        editingId ? `/api/patients/${editingId}` : '/api/patients',
        {
          method: editingId ? 'PATCH' : 'POST',
          body: JSON.stringify(payload),
        },
      );
      setFormOpen(false);
      setForm(emptyForm);
      setEditingId(null);
      await loadPatients();
    } catch (requestError) {
      setError(requestError.message || 'Could not save patient record.');
    } finally {
      setSaving(false);
    }
  };

  const openPatientDetails = async (patient) => {
    setSelectedPatient(patient);
    setClinicalHistory([]);
    setXrayHistory([]);
    setHistoryLoading(true);
    setError('');
    try {
      const [reports, screenings] = await Promise.all([
        apiRequest(`/api/patients/${patient.id}/clinical-assessments`),
        apiRequest(`/api/patients/${patient.id}/xray-screenings`),
      ]);
      setClinicalHistory(reports);
      setXrayHistory(screenings);
    } catch (requestError) {
      setError(requestError.message || 'Could not load the patient clinical history.');
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedPatient) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setSelectedPatient(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedPatient]);

  return (
    <div className="patients-page" style={{ animation: 'fadeIn 0.3s ease' }}>
      <header className="panel-header" style={{ marginBottom: '24px' }}>
        <div>
          <h2 className="panel-title" style={{ fontSize: '24px' }}>Patient Records</h2>
          <p style={{ color: 'var(--color-neutral-500)', margin: '6px 0 0' }}>
            Your records are private to your staff account.
          </p>
        </div>
        <button className="btn btn--primary" onClick={openNewPatient}>
          + Add New Patient
        </button>
      </header>

      {error && (
        <div role="alert" style={{
          padding: '12px 16px',
          marginBottom: '16px',
          borderRadius: '8px',
          color: '#b91c1c',
          background: '#fef2f2',
          border: '1px solid #fecaca',
        }}>
          {error}
        </div>
      )}

      {formOpen && (
        <form className="card" onSubmit={handleSubmit} style={{ marginBottom: '20px' }}>
          <h3 style={{ marginTop: 0 }}>{editingId ? 'Edit Patient' : 'Add Patient'}</h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '14px',
          }}>
            <label>
              Patient name *
              <input
                required
                maxLength={150}
                value={form.fullName}
                onChange={(event) => setForm({ ...form, fullName: event.target.value })}
                style={fieldStyle}
                autoComplete="name"
              />
            </label>
            <label>
              Phone
              <input
                type="tel"
                maxLength={40}
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
                style={fieldStyle}
                autoComplete="tel"
              />
            </label>
            <label>
              Date of birth
              <input
                type="date"
                value={form.dateOfBirth}
                onChange={(event) => setForm({ ...form, dateOfBirth: event.target.value })}
                style={fieldStyle}
              />
            </label>
            <label>
              Gender
              <input
                maxLength={30}
                value={form.gender}
                onChange={(event) => setForm({ ...form, gender: event.target.value })}
                style={fieldStyle}
                placeholder="Optional"
              />
            </label>
            <label style={{ gridColumn: '1 / -1' }}>
              Notes
              <textarea
                maxLength={5000}
                rows={3}
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                style={{ ...fieldStyle, resize: 'vertical' }}
                placeholder="Optional patient notes"
              />
            </label>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => { setFormOpen(false); setError(''); }}
              disabled={saving}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Save Patient'}
            </button>
          </div>
        </form>
      )}

      <div className="card" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', minWidth: '650px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-neutral-200)' }}>
              <th style={{ padding: '12px' }}>ID</th>
              <th style={{ padding: '12px' }}>Patient Name</th>
              <th style={{ padding: '12px' }}>Age / Gender</th>
              <th style={{ padding: '12px' }}>Phone</th>
              <th style={{ padding: '12px' }}>Last Completed Visit</th>
              <th style={{ padding: '12px' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" style={{ padding: '20px' }}>Loading patient records…</td></tr>
            ) : visiblePatients.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ padding: '24px', textAlign: 'center', color: 'var(--color-neutral-500)' }}>
                  {normalizedQuery
                    ? `No patient records match “${searchQuery}”.`
                    : 'No patient records yet. Add a patient to get started.'}
                </td>
              </tr>
            ) : visiblePatients.map((patient) => (
              <tr key={patient.id} style={{ borderBottom: '1px solid var(--color-neutral-100)' }}>
                <td style={{ padding: '12px', fontWeight: 'bold' }}>PT-{patient.id}</td>
                <td style={{ padding: '12px' }}>{patient.fullName}</td>
                <td style={{ padding: '12px', color: 'var(--color-neutral-500)' }}>
                  {formatAge(patient.dateOfBirth)}{patient.gender ? ` / ${patient.gender}` : ''}
                </td>
                <td style={{ padding: '12px' }}>{patient.phone || '—'}</td>
                <td style={{ padding: '12px' }}>{formatDate(patient.lastVisit)}</td>
                <td style={{ padding: '12px' }}>
                  <button className="btn-link" onClick={() => editPatient(patient)}>Edit</button>
                  {' · '}
                  <button className="btn-link" onClick={() => openPatientDetails(patient)}>
                    View patient
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedPatient && (
        <div
          className="patient-detail-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedPatient(null);
          }}
        >
          <section
            className="patient-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="patient-detail-title"
          >
            <header className="patient-detail-modal__header">
              <div>
                <span className="patient-detail-modal__eyebrow">PATIENT RECORD · PT-{selectedPatient.id}</span>
                <h2 id="patient-detail-title">{selectedPatient.fullName}</h2>
                <p>Private patient details and saved clinical history</p>
              </div>
              <button
                className="patient-detail-modal__close"
                type="button"
                aria-label="Close patient details"
                onClick={() => setSelectedPatient(null)}
              >
                ×
              </button>
            </header>

            <div className="patient-detail-modal__content">
              {error && <div role="alert" className="patient-detail-error">{error}</div>}
              <section className="patient-detail-section">
                <h3>Patient information</h3>
                <div className="patient-detail-grid">
                  <div><span>Full name</span><strong>{selectedPatient.fullName}</strong></div>
                  <div><span>Patient ID</span><strong>PT-{selectedPatient.id}</strong></div>
                  <div><span>Phone</span><strong>{selectedPatient.phone || 'Not provided'}</strong></div>
                  <div><span>Date of birth</span><strong>{selectedPatient.dateOfBirth || 'Not provided'}</strong></div>
                  <div><span>Age</span><strong>{formatAge(selectedPatient.dateOfBirth)}</strong></div>
                  <div><span>Gender</span><strong>{selectedPatient.gender || 'Not provided'}</strong></div>
                  <div><span>Last completed visit</span><strong>{formatDate(selectedPatient.lastVisit)}</strong></div>
                  <div className="patient-detail-grid__notes"><span>Patient notes</span><strong>{selectedPatient.notes || 'No notes recorded'}</strong></div>
                </div>
                <button className="btn-link" onClick={() => { setSelectedPatient(null); editPatient(selectedPatient); }}>
                  Edit patient information
                </button>
              </section>

              <section className="patient-detail-section">
                <div className="patient-detail-section__heading">
                  <div>
                    <h3>Saved X-ray screens</h3>
                    <p>Research-only flags require clinician review; they do not diagnose or rule out TB.</p>
                  </div>
                  <span>{xrayHistory.length}</span>
                </div>
                {historyLoading ? (
                  <p className="patient-detail-empty">Loading saved screens…</p>
                ) : xrayHistory.length === 0 ? (
                  <p className="patient-detail-empty">No X-ray screens saved for this patient.</p>
                ) : (
                  <div className="patient-detail-xrays">
                    {xrayHistory.map((screening) => (
                      <article key={screening.id} className="patient-detail-xray">
                        <img
                          src={`${API_BASE_URL}/api/patients/${selectedPatient.id}/xray-screenings/${screening.id}/image`}
                          alt={`Saved chest X-ray screening ${screening.id}`}
                          crossOrigin="use-credentials"
                          loading="lazy"
                        />
                        <div>
                          <strong>{screening.reviewFlagged ? 'Flagged for clinician review' : 'No flag at this threshold'}</strong>
                          <span>{new Date(screening.createdAt).toLocaleString()}</span>
                          <span>Research score {(screening.modelScore * 100).toFixed(1)}% · not a disease probability</span>
                          <small>Image record #{screening.id}</small>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section className="patient-detail-section">
                <div className="patient-detail-section__heading">
                  <div>
                    <h3>Reports & medication plans</h3>
                    <p>Clinician-entered reports and plans saved for this patient.</p>
                  </div>
                  <span>{clinicalHistory.length}</span>
                </div>
                {historyLoading ? (
                  <p className="patient-detail-empty">Loading reports…</p>
                ) : clinicalHistory.length === 0 ? (
                  <p className="patient-detail-empty">No reports or medication plans saved for this patient.</p>
                ) : (
                  <div className="patient-detail-reports">
                    {clinicalHistory.map((entry) => (
                      <article key={entry.id} className="patient-detail-report">
                        <strong>Radiology report · {new Date(entry.createdAt).toLocaleString()}</strong>
                        <p>{entry.radiologyReport}</p>
                        <small>
                          Ethiopian STG pages: {entry.guidelineMatches.map((match) => match.page).join(', ') || 'No relevant matches'}
                        </small>
                        {entry.medicationPlans.map((plan) => (
                          <div key={plan.id} className="patient-detail-medication">
                            <strong>Clinician-reviewed medication: {plan.medicationName}</strong>
                            <span>{plan.dose} · {plan.route} · {plan.frequency} · {plan.duration} · {plan.timing}</span>
                            {plan.instructions && <span>{plan.instructions}</span>}
                          </div>
                        ))}
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
