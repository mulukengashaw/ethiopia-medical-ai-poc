import { useEffect, useState } from 'react';
import { apiRequest } from '../api';

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid var(--color-neutral-200)',
  font: 'inherit',
};

const emptyMedicationPlan = {
  medicationName: '',
  dose: '',
  route: '',
  frequency: '',
  duration: '',
  timing: '',
  instructions: '',
  guidelinePages: [],
  clinicianConfirmed: false,
};

function formatDateTime(value) {
  return new Date(value).toLocaleString();
}

function getPatientScreeningMessage(screeningResult) {
  if (screeningResult.reviewFlagged) {
    return 'The image needs a clinician’s review for possible TB. This screening cannot confirm TB; your clinician will explain any next steps.';
  }
  return 'The research screen did not flag this image, but it cannot rule out TB. Please discuss your symptoms and any concerns with your clinician.';
}

export default function XRayAnalysis() {
  const [patients, setPatients] = useState([]);
  const [patientId, setPatientId] = useState('');
  const [radiologyReport, setRadiologyReport] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [xrayFile, setXrayFile] = useState(null);
  const [fileInputVersion, setFileInputVersion] = useState(0);
  const [screeningStatus, setScreeningStatus] = useState(null);
  const [screeningResult, setScreeningResult] = useState(null);
  const [assessment, setAssessment] = useState(null);
  const [patientHistory, setPatientHistory] = useState([]);
  const [medicationPlan, setMedicationPlan] = useState(emptyMedicationPlan);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [searching, setSearching] = useState(false);
  const [screening, setScreening] = useState(false);
  const [savingMedication, setSavingMedication] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    apiRequest('/api/patients')
      .then((rows) => {
        if (active) setPatients(rows);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || 'Could not load patients.');
      })
      .finally(() => {
        if (active) setLoadingPatients(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    apiRequest('/api/xray-screening/status')
      .then((status) => {
        if (active) setScreeningStatus(status);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || 'Could not load X-ray model status.');
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!imagePreview) return undefined;
    return () => URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);

  useEffect(() => {
    if (!screeningResult) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setScreeningResult(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [screeningResult]);

  useEffect(() => {
    if (!patientId) return undefined;

    let active = true;
    apiRequest(`/api/patients/${patientId}/clinical-assessments`)
      .then((rows) => {
        if (active) setPatientHistory(rows);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || 'Could not load patient reports.');
      });
    return () => { active = false; };
  }, [patientId]);

  const acceptXrayFile = (file) => {
    if (!file) return;
    setScreeningResult(null);
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      setError('Choose a PNG or JPEG image. DICOM preview is not supported in this screen.');
      setXrayFile(null);
      setImagePreview('');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be 10 MB or smaller.');
      setXrayFile(null);
      setImagePreview('');
      return;
    }
    setError('');
    setXrayFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleImageChange = (event) => {
    acceptXrayFile(event.target.files?.[0]);
    event.target.value = '';
  };

  const handleImageDrop = (event) => {
    event.preventDefault();
    acceptXrayFile(event.dataTransfer.files?.[0]);
  };

  const screenPatientXray = async () => {
    if (!patientId || !xrayFile) {
      setError('Select a patient and a PNG or JPEG image before screening.');
      return;
    }
    setScreening(true);
    setError('');
    setNotice('');
    try {
      const formData = new FormData();
      formData.append('image', xrayFile);
      const result = await apiRequest(`/api/patients/${patientId}/xray-screenings`, {
        method: 'POST',
        body: formData,
      });
      setScreeningResult({ saved: true, result });
      setXrayFile(null);
      setImagePreview('');
      setFileInputVersion((version) => version + 1);
    } catch (requestError) {
      setScreeningResult({
        saved: false,
        saveConfirmed: Boolean(requestError.status),
        message: requestError.message || 'Could not screen and save this X-ray.',
      });
    } finally {
      setScreening(false);
    }
  };

  const saveReportAndFindGuidance = async (event) => {
    event.preventDefault();
    if (!patientId) {
      setError('Select a patient before saving a report.');
      return;
    }
    setSearching(true);
    setError('');
    setNotice('');
    setMedicationPlan(emptyMedicationPlan);
    try {
      const saved = await apiRequest('/api/clinical-assessments', {
        method: 'POST',
        body: JSON.stringify({
          patientId: Number(patientId),
          radiologyReport,
        }),
      });
      setAssessment(saved);
      setPatientHistory((current) => [saved, ...current]);
      setNotice('Report saved to the selected patient. Guideline matches were searched locally.');
    } catch (requestError) {
      setError(requestError.message || 'Could not save the report.');
    } finally {
      setSearching(false);
    }
  };

  const saveMedicationPlan = async (event) => {
    event.preventDefault();
    if (!assessment) return;
    setSavingMedication(true);
    setError('');
    try {
      await apiRequest(
        `/api/clinical-assessments/${assessment.id}/medication-plans`,
        {
          method: 'POST',
          body: JSON.stringify({
            ...medicationPlan,
            guidelinePages: medicationPlan.guidelinePages.map(Number),
            instructions: medicationPlan.instructions.trim() || null,
          }),
        },
      );
      setMedicationPlan(emptyMedicationPlan);
      setNotice('Clinician-reviewed medication plan saved to the selected patient.');
      const updatedHistory = await apiRequest(
        `/api/patients/${patientId}/clinical-assessments`,
      );
      setPatientHistory(updatedHistory);
      setAssessment(updatedHistory.find((item) => item.id === assessment.id) || assessment);
    } catch (requestError) {
      setError(requestError.message || 'Could not save medication plan.');
    } finally {
      setSavingMedication(false);
    }
  };

  const toggleGuidelinePage = (page) => {
    setMedicationPlan((current) => ({
      ...current,
      guidelinePages: current.guidelinePages.includes(page)
        ? current.guidelinePages.filter((item) => item !== page)
        : [...current.guidelinePages, page],
    }));
  };

  return (
    <div className="xray-page">
      <header className="xray-hero">
        <div className="xray-hero__copy">
          <span className="xray-hero__eyebrow">
            <span className="xray-hero__pulse" />
            CLINICIAN-LED · RESEARCH-ONLY SCREENING
          </span>
          <h1 className="xray-hero__title">Chest X-ray review</h1>
          <p className="xray-hero__subtitle">
            Keep images, clinician reports, and Ethiopian guideline references together in one patient record.
          </p>
          <div className="xray-hero__steps" aria-label="Review workflow">
            <span><b>01</b> Choose patient</span>
            <span><b>02</b> Add X-ray or report</span>
            <span><b>03</b> Clinician reviews</span>
          </div>
        </div>
        <div className="xray-hero__art" aria-hidden="true">
          <div className="xray-hero__ring xray-hero__ring--outer" />
          <div className="xray-hero__ring xray-hero__ring--inner" />
          <span className="xray-hero__art-icon">🩻</span>
          <span className="xray-hero__art-tag">REVIEW<br />WITH CARE</span>
        </div>
      </header>

      <div role="note" className="xray-safety-note">
        <span className="xray-safety-note__icon" aria-hidden="true">i</span>
        <p>
          <strong>Important: this tool does not diagnose TB.</strong> A model flag is not proof of infection, and a result below
          threshold cannot rule TB out. A qualified clinician must assess the patient and decide whether further testing is needed.
          Images are saved to the selected patient record when you run screening.
        </p>
      </div>

      <section className="xray-model-card">
        <div className="xray-model-card__heading">
          <div>
            <span className="xray-model-card__eyebrow">LOCAL PYTHON MODEL</span>
            <h2>Research screening status</h2>
            <p>A review-priority signal only — the score is not a probability of disease.</p>
          </div>
          <span className={`xray-model-status ${screeningStatus?.available ? 'xray-model-status--ready' : ''}`}>
            <span />{screeningStatus === null ? 'Checking model' : screeningStatus.available ? 'Model ready' : 'Model unavailable'}
          </span>
        </div>
        {screeningStatus === null ? (
          <p role="status" className="xray-model-card__message">Checking whether the trained model is installed…</p>
        ) : screeningStatus.available ? (
          <>
            <div className="xray-metrics">
              {[
                ['Held-out images', screeningStatus.metrics.image_count],
                ['Accuracy', `${(screeningStatus.metrics.accuracy * 100).toFixed(1)}%`],
                ['Sensitivity', `${(screeningStatus.metrics.sensitivity * 100).toFixed(1)}%`],
                ['Specificity', `${(screeningStatus.metrics.specificity * 100).toFixed(1)}%`],
                ['ROC AUC', screeningStatus.metrics.roc_auc.toFixed(3)],
              ].map(([label, value]) => (
                <div key={label} className="xray-metric">
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
            <details className="xray-limitations">
              <summary>Dataset and validation limitations</summary>
              <ul>
                {screeningStatus.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}
              </ul>
              <p>
                Training images by dataset label: {screeningStatus.datasetClassCounts.Normal} normal-labeled and{' '}
                {screeningStatus.datasetClassCounts.Tuberculosis} TB-labeled.
              </p>
            </details>
          </>
        ) : (
          <div role="status" className="xray-model-card__message">
            {screeningStatus.message}
          </div>
        )}
      </section>

      {error && (
        <div role="alert" style={{ padding: '12px 16px', borderRadius: '8px', color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca' }}>
          {error}
        </div>
      )}
      {notice && (
        <div role="status" style={{ padding: '12px 16px', borderRadius: '8px', color: '#166534', background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
          {notice}
        </div>
      )}

      <section className="xray-workspace">
        <div className="xray-workspace__header">
          <div>
            <span className="xray-workspace__eyebrow">NEW PATIENT REVIEW</span>
            <h2>Start an X-ray review</h2>
            <p>Choose a patient, add an image, then save a clinician report when available.</p>
          </div>
          <span className="xray-workspace__secure"><span aria-hidden="true">●</span> Patient-linked</span>
        </div>

        <div className="xray-workspace__grid">
          <div className="xray-workspace__details">
            <label className="xray-field">
              <span className="xray-field__label"><span>1</span> Select patient *</span>
              <select
                required
                value={patientId}
                onChange={(event) => {
                  setPatientId(event.target.value);
                  setAssessment(null);
                  setPatientHistory([]);
                  setScreeningResult(null);
                  setXrayFile(null);
                  setImagePreview('');
                  setError('');
                  setNotice('');
                }}
                style={inputStyle}
                disabled={loadingPatients}
              >
                <option value="">{loadingPatients ? 'Loading patients…' : 'Choose a patient record'}</option>
                {patients.map((patient) => (
                  <option key={patient.id} value={patient.id}>{patient.fullName}</option>
                ))}
              </select>
              {!loadingPatients && patients.length === 0 && (
                <small>Add a patient in Patients before creating a report.</small>
              )}
            </label>

            <label className="xray-field">
              <span className="xray-field__label"><span>2</span> Clinician report <small>Optional</small></span>
              <textarea
                minLength={1}
                maxLength={10000}
                rows={7}
                value={radiologyReport}
                onChange={(event) => setRadiologyReport(event.target.value)}
                style={{ ...inputStyle, resize: 'vertical' }}
                placeholder="Add the qualified image reader’s findings and impression."
              />
              <small>Only enter a report reviewed by a qualified clinician.</small>
            </label>
          </div>

          <div className="xray-upload-column">
            <div className="xray-upload-heading">
              <span className="xray-field__label"><span>3</span> Add chest X-ray</span>
              <small>PNG or JPEG · up to 10 MB</small>
            </div>
            <label
              className={`xray-upload-dropzone ${imagePreview ? 'xray-upload-dropzone--has-image' : ''}`}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleImageDrop}
            >
              <input
                key={`${patientId || 'no-patient'}-${fileInputVersion}`}
                className="xray-upload-input"
                type="file"
                accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                onChange={handleImageChange}
                aria-label="Choose a chest X-ray image"
              />
              {imagePreview ? (
                <>
                  <img src={imagePreview} alt="Selected chest X-ray preview" className="xray-upload-preview" />
                  <span className="xray-upload-file">{xrayFile?.name}</span>
                  <span className="xray-upload-hint">Choose another image or drop it here</span>
                </>
              ) : (
                <>
                  <span className="xray-upload-icon" aria-hidden="true">
                    <svg viewBox="0 0 48 48" fill="none">
                      <path d="M24 31V9m0 0-8 8m8-8 8 8M10 29v9a3 3 0 0 0 3 3h22a3 3 0 0 0 3-3v-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <strong>Drop an X-ray image here</strong>
                  <span className="xray-upload-hint">or browse PNG / JPEG files</span>
                  <span className="xray-upload-browse">Choose image</span>
                </>
              )}
            </label>
            <p className="xray-upload-privacy">
              🔒 The image is saved locally and linked to the selected patient when screening starts.
            </p>
          </div>
        </div>

        <div className="xray-workspace__actions">
          <button
            className="xray-screen-button"
            type="button"
            disabled={!patientId || !xrayFile || !screeningStatus?.available || screening}
            onClick={screenPatientXray}
          >
            {screening ? (
              <><span className="xray-screen-button__spinner" /> Screening and saving…</>
            ) : (
              <>Run research screen <span aria-hidden="true">→</span></>
            )}
          </button>
          <button
            className="xray-report-button"
            type="button"
            disabled={!patientId || !radiologyReport.trim() || searching}
            onClick={saveReportAndFindGuidance}
          >
            {searching ? 'Saving report…' : 'Save clinician report & find guidelines'}
          </button>
        </div>
        {!screeningStatus?.available && (
          <small className="xray-workspace__hint">Image screening is disabled until the trained local model is available.</small>
        )}
      </section>

      {screeningResult && (
        <div className="xray-result-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setScreeningResult(null);
        }}>
          <section
            className={`xray-result-modal ${
              screeningResult.saved
                ? (screeningResult.result.reviewFlagged ? 'xray-result-modal--review' : 'xray-result-modal--clear')
                : 'xray-result-modal--failed'
            }`}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="xray-result-title"
            aria-describedby="xray-result-message"
          >
            <button
              className="xray-result-modal__close"
              type="button"
              aria-label="Close screening result"
              onClick={() => setScreeningResult(null)}
            >
              ×
            </button>
            <div className="xray-result-modal__icon" aria-hidden="true">
              {!screeningResult.saved ? '!' : screeningResult.result.reviewFlagged ? '!' : '✓'}
            </div>
            <span className="xray-result-modal__eyebrow">
              {!screeningResult.saved
                ? (screeningResult.saveConfirmed ? 'SAVE FAILED' : 'SAVE NOT CONFIRMED')
                : `SAVE CONFIRMED · RECORD #${screeningResult.result.id}`}
            </span>
            <h2 id="xray-result-title">
              {!screeningResult.saved
                ? (screeningResult.saveConfirmed ? 'X-ray was not saved' : 'Could not confirm the save')
                : screeningResult.result.reviewFlagged ? 'Needs clinician review' : 'No flag at this threshold'}
            </h2>
            <p id="xray-result-message" className="xray-result-modal__message">
              {!screeningResult.saved
                ? (screeningResult.saveConfirmed
                  ? screeningResult.message
                  : 'The connection did not confirm whether this image was saved. Check the patient record before trying again.')
                : getPatientScreeningMessage(screeningResult.result)}
            </p>
            <div className="xray-result-modal__disclaimer">
              {screeningResult.saved ? (
                <>
                  <strong>Research screening only</strong>
                  <span>This result cannot diagnose TB or rule it out.</span>
                </>
              ) : (
                <>
                  <strong>{screeningResult.saveConfirmed ? 'Save was not successful' : 'Save status is unknown'}</strong>
                  <span>{screeningResult.saveConfirmed ? 'Your selected image is still available. Correct the issue and try again.' : 'Check the patient history before uploading again to avoid duplicate records.'}</span>
                </>
              )}
            </div>
            <button
              className="xray-result-modal__button"
              type="button"
              autoFocus
              onClick={() => setScreeningResult(null)}
            >
              {screeningResult.saved ? 'I understand' : 'Close and review'}
            </button>
          </section>
        </div>
      )}

      {assessment && (
        <section className="card" style={{ display: 'grid', gap: '16px' }}>
          <div>
            <h2 style={{ margin: '0 0 6px' }}>Local Ethiopian guideline matches</h2>
            <p style={{ margin: 0, color: 'var(--color-neutral-500)' }}>
              Source excerpts, not AI-generated treatment advice. Check the cited PDF pages and the patient&apos;s full clinical context.
            </p>
          </div>
          {assessment.guidelineMatches.length === 0 ? (
            <p>No sufficiently relevant passage was found. Do not infer a medication plan from this search.</p>
          ) : assessment.guidelineMatches.map((match, index) => (
            <article key={`${assessment.id}-${match.page}-${index}`} style={{ border: '1px solid var(--color-neutral-200)', borderRadius: '8px', padding: '14px' }}>
              <strong>
                [STG-General-Hospital.pdf, page {match.page}]
                {' · '}Local relevance {match.relevance}
              </strong>
              <p style={{ marginBottom: 0, lineHeight: 1.6 }}>{match.text}</p>
            </article>
          ))}

          <form onSubmit={saveMedicationPlan} style={{ borderTop: '1px solid var(--color-neutral-200)', paddingTop: '18px', display: 'grid', gap: '14px' }}>
            <div>
              <h3 style={{ margin: '0 0 6px' }}>Clinician-entered medication plan (optional)</h3>
              <p style={{ margin: 0, color: 'var(--color-neutral-500)' }}>
                Nothing is prefilled by AI. Enter a plan only after checking the full guideline, diagnosis, allergies, age, weight, pregnancy status, comorbidities, and local formulary.
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px' }}>
              <label>
                Drug / medication *
                <input required maxLength={200} value={medicationPlan.medicationName} onChange={(event) => setMedicationPlan({ ...medicationPlan, medicationName: event.target.value })} style={inputStyle} />
              </label>
              <label>
                Dose *
                <input required maxLength={150} value={medicationPlan.dose} onChange={(event) => setMedicationPlan({ ...medicationPlan, dose: event.target.value })} style={inputStyle} placeholder="Clinician-entered" />
              </label>
              <label>
                Route *
                <input required maxLength={100} value={medicationPlan.route} onChange={(event) => setMedicationPlan({ ...medicationPlan, route: event.target.value })} style={inputStyle} placeholder="e.g. oral" />
              </label>
              <label>
                Frequency *
                <input required maxLength={150} value={medicationPlan.frequency} onChange={(event) => setMedicationPlan({ ...medicationPlan, frequency: event.target.value })} style={inputStyle} placeholder="Clinician-entered" />
              </label>
              <label>
                Duration *
                <input required maxLength={150} value={medicationPlan.duration} onChange={(event) => setMedicationPlan({ ...medicationPlan, duration: event.target.value })} style={inputStyle} placeholder="Clinician-entered" />
              </label>
              <label>
                Timing / schedule *
                <input required maxLength={250} value={medicationPlan.timing} onChange={(event) => setMedicationPlan({ ...medicationPlan, timing: event.target.value })} style={inputStyle} placeholder="Clinician-entered" />
              </label>
              <label style={{ gridColumn: '1 / -1' }}>
                Instructions
                <textarea maxLength={2000} rows={2} value={medicationPlan.instructions} onChange={(event) => setMedicationPlan({ ...medicationPlan, instructions: event.target.value })} style={{ ...inputStyle, resize: 'vertical' }} />
              </label>
            </div>
            {assessment.guidelineMatches.length > 0 && (
              <fieldset style={{ border: '1px solid var(--color-neutral-200)', borderRadius: '8px', padding: '12px' }}>
                <legend>Guideline pages reviewed (optional)</legend>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                  {assessment.guidelineMatches.map((match) => (
                    <label key={match.page} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input type="checkbox" checked={medicationPlan.guidelinePages.includes(match.page)} onChange={() => toggleGuidelinePage(match.page)} />
                      Page {match.page}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <input
                type="checkbox"
                required
                checked={medicationPlan.clinicianConfirmed}
                onChange={(event) => setMedicationPlan({ ...medicationPlan, clinicianConfirmed: event.target.checked })}
                style={{ marginTop: '4px' }}
              />
              <span>I am the responsible clinician and have independently reviewed and confirmed this medication, dose, route, frequency, duration, and timing for this patient.</span>
            </label>
            <button className="btn btn--primary" type="submit" disabled={savingMedication}>
              {savingMedication ? 'Saving reviewed plan…' : 'Save clinician-reviewed plan to patient'}
            </button>
          </form>
        </section>
      )}

      {patientId && patientHistory.length > 0 && (
        <section className="card" style={{ display: 'grid', gap: '14px' }}>
          <h2 style={{ margin: 0 }}>Saved reports and plans for this patient</h2>
          {patientHistory.map((entry) => (
            <article key={entry.id} style={{ borderTop: '1px solid var(--color-neutral-200)', paddingTop: '14px' }}>
              <strong>{formatDateTime(entry.createdAt)}</strong>
              <p style={{ whiteSpace: 'pre-wrap' }}>{entry.radiologyReport}</p>
              <div style={{ color: 'var(--color-neutral-500)' }}>
                Guideline pages: {entry.guidelineMatches.map((match) => match.page).join(', ') || 'No relevant matches found'}
              </div>
              {entry.medicationPlans.map((plan) => (
                <div key={plan.id} style={{ marginTop: '10px', padding: '12px', background: 'var(--color-neutral-50, #f9fafb)', borderRadius: '8px' }}>
                  <strong>Clinician-reviewed plan: {plan.medicationName}</strong>
                  <div>{plan.dose} · {plan.route} · {plan.frequency} · {plan.duration} · {plan.timing}</div>
                  {plan.instructions && <div>{plan.instructions}</div>}
                  <small>Reviewed guideline pages: {plan.guidelinePages.join(', ') || 'Not recorded'}</small>
                </div>
              ))}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
