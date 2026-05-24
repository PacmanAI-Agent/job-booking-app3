// ==== CONFIG - Airtable details (no API key needed here) ====
const BASE_ID       = 'appX0OtnSWt8JOKvh';
const TABLE_ID      = 'tblHkIbvRNOcx6lVQ';

// ====================================================

// Prompt for API key when needed - never stored in code
let AIRTABLE_API_KEY = localStorage.getItem('airtable_api_key');

function getApiKey() {
  if (!AIRTABLE_API_KEY) {
    AIRTABLE_API_KEY = prompt('Enter your Airtable API key (pat...):');
    if (AIRTABLE_API_KEY) {
      localStorage.setItem('airtable_api_key', AIRTABLE_API_KEY);
    }
  }
  return AIRTABLE_API_KEY;
}

const form = document.getElementById('bookingForm');
// Company name is fixed in the HTML (hidden input & static display)
const companyInput = document.getElementById('company');
const companyName = companyInput ? companyInput.value : '';
const statusEl = document.getElementById('status');

// Auto‑fill today's date (native date input)
function initDatePicker() {
  const dateInput = document.getElementById('date-picker');
  if (dateInput) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
  }
}

// Run after DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDatePicker);
} else {
  initDatePicker();
}

form.addEventListener('submit', async e => {
  e.preventDefault();
  statusEl.textContent = 'Sending...';

  const formData = new FormData(form);
  const fields = {};

  // Simple scalar fields (including Company)
  ['Destination','Address','Description','Phone','Date','Company'].forEach(k => {
    const v = formData.get(k);
    if (v) fields[k] = v;
  });

  // Checkboxes
  fields.PickUp = formData.get('PickUp') ? 'Yes' : 'No';
  fields.DropOff = formData.get('DropOff') ? 'Yes' : 'No';

  // Attachments - upload each file then store URLs
  const attachments = formData.getAll('Attachments');
  if (attachments.length) {
    const uploaded = await Promise.all(attachments.map(uploadFile));
    fields.Attachments = uploaded.map(u => ({url:u}));
  }

  try {
    const resp = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({fields})
    });
    if (!resp.ok) throw new Error(`Airtable error ${resp.status}`);
    await resp.json();
    statusEl.textContent = '✅ Job booked!';
    form.reset();
    // Reset date to today after successful submit
    initDatePicker();
  } catch (err) {
    console.error(err);
    statusEl.textContent = '❌ Failed - check console';
  }
});

// Helper - upload a file to Airtable's attachment endpoint
async function uploadFile(file) {
  const uploadResp = await fetch('https://api.airtable.com/v0/meta/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${getApiKey()}` },
    body: file
  });
  if (!uploadResp.ok) throw new Error('Upload failed');
  const json = await uploadResp.json();
  return json.url; // direct URL to the stored file
}