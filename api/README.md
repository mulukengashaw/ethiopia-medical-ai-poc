# Google sign-in

Google sign-in and sign-up use the backend OAuth authorization-code flow. The
first Google sign-in creates a user account; later sign-ins reuse it. Existing
accounts with a matching verified Google email are linked automatically.

## Google Cloud setup

Create a **Web application** OAuth client in Google Cloud Console and configure:

- Authorized JavaScript origin: `http://localhost:5173`
- Authorized redirect URI: `http://localhost:8000/api/auth/google/callback`

Install `google-auth` in the Python environment used to run the API:

```powershell
python -m pip install google-auth requests
```

Set the OAuth values in the same PowerShell window that starts the API:

```powershell
$env:GOOGLE_CLIENT_ID = "<OAuth client ID>"
$env:GOOGLE_CLIENT_SECRET = "<OAuth client secret>"
$env:GOOGLE_REDIRECT_URI = "http://localhost:8000/api/auth/google/callback"
$env:FRONTEND_URL = "http://localhost:5173"
$env:GMAIL_APP_PASSWORD = "<Gmail app password>"
python -c "import secrets; print(secrets.token_urlsafe(48))"
$env:GOOGLE_SESSION_SECRET = "<paste the generated value here and keep it stable>"
```

Alternatively, save those `KEY=value` settings in `api/.env`. The API loads that
file at startup, and `api/.gitignore` excludes it from Git. Existing process
environment variables take precedence over values in the file.

Stop any already-running API with `Ctrl+C`. In the same PowerShell window where
you set the variables (or from the project virtual environment when using
`api/.env`), start the API:

```powershell
Set-Location "C:\Users\Gursha Tech\Desktop\ethiopia-medical-ai-poc\api"
..\venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

Keep that API window open while using the app. Setting variables in a different
PowerShell window does not update an API process that is already running. The
API logs the names of any missing OAuth variables when Google sign-in is
attempted, without logging their values.

The OAuth client ID and secret come from the Google Cloud OAuth client; the
Gmail app password is not an OAuth credential. If any of the three OAuth
variables are missing, Google sign-in redirects back with a not-configured
message. Restart the API after setting them.

Email-and-password signup requires a name, email address, and password. Login
uses the same email address and password. Welcome emails are sent from
`muluken19943@gmail.com` when `GMAIL_APP_PASSWORD` is configured; Gmail SMTP
settings are optional, so signup and login still work without email delivery.

Run the database initializer once to add the Google account identifier column
to an existing `users` table and create the patient, appointment, radiology
report, clinician-reviewed medication-plan, and X-ray screening tables:

```powershell
Set-Location "C:\Users\Gursha Tech\Desktop\ethiopia-medical-ai-poc\api"
..\venv\Scripts\python.exe init_db.py
```

Patient records and appointments are private to the account that created them.
After signing in, use **Patients** to create and edit patient records, and
**Appointments** to schedule, reschedule, complete, or cancel visits. Records
are saved in the local MySQL database and remain available after signing out
and back in with the same account.

The **TB X-Ray Analysis** screen accepts a qualified reader's written or pasted
radiology report, assigns it to one of your patients, and retrieves relevant
passages from every page of `data/raw/STG-General-Hospital.pdf` using a local
TF-IDF search. Report text, matching excerpts/page references, and
clinician-entered treatment plans are saved with that patient. A medication
plan can only be saved after the signed-in clinician confirms they independently
reviewed the medication and all directions. The software does not select drugs,
doses, or schedules.

## Local research X-ray screening

The optional image screen is a small PyTorch model trained locally from the
image-level `Normal` and `Tuberculosis` classes in
`data/raw/TB_Chest_Radiography_Database`. Install the ML dependencies into the
same virtual environment that runs the API, train the model, and create the
screening database table:

```powershell
Set-Location "C:\Users\Gursha Tech\Desktop\ethiopia-medical-ai-poc"
.\venv\Scripts\python.exe -m pip install -r api\requirements-ml.txt
.\venv\Scripts\python.exe api\train_xray_model.py
.\venv\Scripts\python.exe api\init_db.py
```

The trainer uses a deterministic stratified 70/15/15 image-level train,
validation, and test split; early stopping uses validation loss, and the
review threshold is selected on validation data. The training page reports
held-out test accuracy, sensitivity, specificity, ROC AUC, and confusion
counts. These are dataset-specific image-level results, not clinical
performance. The dataset has no patient identifiers, has mixed provenance,
and can contain source or patient overlap between splits. It is not an
independent clinical or external validation cohort. The displayed score is
not a calibrated probability. Do not use this research model to diagnose,
rule out disease, or select treatment.

After training, restart the API. A signed-in staff member can select a patient,
upload a PNG or JPEG (up to 10 MB), and explicitly run the research screen.
The normalized image is stored locally under `data/private/xrays/`; its
patient-linked score, threshold, model version, image hash, and held-out
metrics are saved in MySQL. The X-ray and score are only visible to the staff
account that owns the patient. Model artifacts and saved X-ray images are
excluded from Git. If no model artifact is available, the API reports screening
as unavailable and does not fabricate a result. A qualified clinician must
independently review every image and result.

The Gemini API key is deliberately not used: integrating a hosted model would
send patient images or dictation and credentials to an external provider. Do
not put API keys or real patient information into chat. The PDF matches are
retrieved locally and should be checked against the cited source and complete
patient context.

Patient contact details, radiology reports, and medication plans are sensitive
health information. This project uses a development XAMPP MySQL configuration
with a default local database account. Do not store real patient data or expose
this application beyond a trusted development environment until authentication,
access controls, backups, encryption, audit, privacy, and clinical safety
requirements are appropriately reviewed and implemented.

For deployment, use HTTPS callback and frontend URLs, configure the matching
Google Console URLs, set the UI's `VITE_API_URL` to the API base URL, and keep
the client secret and session secret out of source control. Keep the session
secret stable between API restarts so existing session cookies remain valid.
