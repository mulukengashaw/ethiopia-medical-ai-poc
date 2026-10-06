import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../api';

const fieldStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid var(--color-neutral-200)',
  boxSizing: 'border-box',
  font: 'inherit',
};

function getDefaultSchedule() {
  const date = new Date();
  date.setHours(date.getHours() + 1, 0, 0, 0);
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function statusColor(status) {
  if (status === 'completed') return 'badge--success';
  if (status === 'cancelled') return 'badge--danger';
  return 'badge--primary';
}

const fetchScheduleData = () => Promise.all([
  apiRequest('/api/patients'),
  apiRequest('/api/appointments'),
]);

export default function Appointments({ searchQuery = '' }) {
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [form, setForm] = useState({
    patientId: '',
    scheduledAt: getDefaultSchedule(),
    reason: '',
    location: '',
  });
  const [reschedulingId, setReschedulingId] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
  const visibleAppointments = normalizedQuery
    ? appointments.filter((appointment) => [
      appointment.patientName,
      appointment.reason,
      appointment.location,
      appointment.status,
    ].some((value) => String(value || '').toLocaleLowerCase().includes(normalizedQuery)))
    : appointments;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [patientRows, appointmentRows] = await fetchScheduleData();
      setPatients(patientRows);
      setAppointments(appointmentRows);
      setError('');
    } catch (requestError) {
      setError(requestError.message || 'Could not load appointment data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    fetchScheduleData()
      .then(([patientRows, appointmentRows]) => {
        if (mounted) {
          setPatients(patientRows);
          setAppointments(appointmentRows);
        }
      })
      .catch((requestError) => {
        if (mounted) setError(requestError.message || 'Could not load appointment data.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  const handleCreate = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await apiRequest('/api/appointments', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          patientId: Number(form.patientId),
          reason: form.reason.trim(),
          location: form.location.trim() || null,
        }),
      });
      setForm({
        patientId: '',
        scheduledAt: getDefaultSchedule(),
        reason: '',
        location: '',
      });
      setFormOpen(false);
      await loadData();
    } catch (requestError) {
      setError(requestError.message || 'Could not save appointment.');
    } finally {
      setSaving(false);
    }
  };

  const updateAppointment = async (appointmentId, changes) => {
    setError('');
    try {
      await apiRequest(`/api/appointments/${appointmentId}`, {
        method: 'PATCH',
        body: JSON.stringify(changes),
      });
      setReschedulingId(null);
      await loadData();
    } catch (requestError) {
      setError(requestError.message || 'Could not update appointment.');
    }
  };

  const openScheduleForm = () => {
    setForm({
      patientId: patients[0] ? String(patients[0].id) : '',
      scheduledAt: getDefaultSchedule(),
      reason: '',
      location: '',
    });
    setError('');
    setFormOpen(true);
  };

  return (
    <div className="appointments-page" style={{ animation: 'fadeIn 0.3s ease' }}>
      <header className="panel-header" style={{ marginBottom: '24px' }}>
        <div>
          <h2 className="panel-title" style={{ fontSize: '24px' }}>Appointments</h2>
          <p style={{ color: 'var(--color-neutral-500)', margin: '6px 0 0' }}>
            Your schedule is private to your staff account.
          </p>
        </div>
        <button className="btn btn--primary" onClick={openScheduleForm} disabled={loading}>
          Schedule Appointment
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
        <form className="card" onSubmit={handleCreate} style={{ marginBottom: '20px' }}>
          <h3 style={{ marginTop: 0 }}>Schedule Appointment</h3>
          {patients.length === 0 ? (
            <p>
              Add a patient record before scheduling an appointment.
            </p>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '14px',
            }}>
              <label>
                Patient *
                <select
                  required
                  value={form.patientId}
                  onChange={(event) => setForm({ ...form, patientId: event.target.value })}
                  style={fieldStyle}
                >
                  <option value="">Select a patient</option>
                  {patients.map((patient) => (
                    <option key={patient.id} value={patient.id}>{patient.fullName}</option>
                  ))}
                </select>
              </label>
              <label>
                Date and time *
                <input
                  type="datetime-local"
                  required
                  value={form.scheduledAt}
                  onChange={(event) => setForm({ ...form, scheduledAt: event.target.value })}
                  style={fieldStyle}
                />
              </label>
              <label>
                Appointment reason *
                <input
                  required
                  maxLength={200}
                  value={form.reason}
                  onChange={(event) => setForm({ ...form, reason: event.target.value })}
                  style={fieldStyle}
                  placeholder="Consultation, follow-up…"
                />
              </label>
              <label>
                Room or location
                <input
                  maxLength={150}
                  value={form.location}
                  onChange={(event) => setForm({ ...form, location: event.target.value })}
                  style={fieldStyle}
                  placeholder="Optional"
                />
              </label>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => { setFormOpen(false); setError(''); }}
              disabled={saving}
            >
              Close
            </button>
            {patients.length > 0 && (
              <button type="submit" className="btn btn--primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save Appointment'}
              </button>
            )}
          </div>
        </form>
      )}

      {loading ? (
        <div className="card">Loading appointments…</div>
      ) : visibleAppointments.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--color-neutral-500)' }}>
          {normalizedQuery
            ? `No appointments match “${searchQuery}”.`
            : 'No appointments yet. Schedule an appointment for one of your patients.'}
        </div>
      ) : (
        <div className="bento-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {visibleAppointments.map((appointment) => (
            <article key={appointment.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                <span className={`badge ${statusColor(appointment.status)}`}>
                  {appointment.status}
                </span>
                {appointment.location && (
                  <span style={{ fontSize: '12px', color: 'var(--color-neutral-500)', fontWeight: 'bold' }}>
                    {appointment.location}
                  </span>
                )}
              </div>
              <time dateTime={appointment.scheduledAt} style={{ fontWeight: 700 }}>
                {new Date(appointment.scheduledAt).toLocaleString()}
              </time>
              <h3 style={{ margin: 0, fontSize: '18px' }}>{appointment.patientName}</h3>
              <p style={{ margin: 0, color: 'var(--color-neutral-600)', fontSize: '14px' }}>
                {appointment.reason}
              </p>

              {reschedulingId === appointment.id && (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    updateAppointment(appointment.id, { scheduledAt: rescheduleDate });
                  }}
                  style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}
                >
                  <input
                    type="datetime-local"
                    required
                    value={rescheduleDate}
                    onChange={(event) => setRescheduleDate(event.target.value)}
                    style={{ ...fieldStyle, flex: '1 1 190px' }}
                  />
                  <button className="btn btn--primary" type="submit">Save</button>
                  <button
                    className="btn btn--secondary"
                    type="button"
                    onClick={() => setReschedulingId(null)}
                  >
                    Cancel
                  </button>
                </form>
              )}

              {appointment.status === 'scheduled' && reschedulingId !== appointment.id && (
                <div style={{ marginTop: 'auto', paddingTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    className="btn btn--secondary"
                    style={{ flex: 1, padding: '8px' }}
                    onClick={() => {
                      setReschedulingId(appointment.id);
                      setRescheduleDate(appointment.scheduledAt);
                    }}
                  >
                    Reschedule
                  </button>
                  <button
                    className="btn btn--primary"
                    style={{ flex: 1, padding: '8px' }}
                    onClick={() => updateAppointment(appointment.id, { status: 'completed' })}
                  >
                    Complete
                  </button>
                  <button
                    className="btn btn--secondary"
                    style={{ padding: '8px' }}
                    onClick={() => updateAppointment(appointment.id, { status: 'cancelled' })}
                  >
                    Cancel appointment
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
