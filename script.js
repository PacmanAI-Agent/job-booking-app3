// ==== CONFIG - Airtable details ====
const BASE_ID       = 'appX0OtnSWt8JOKvh';
const TABLE_ID      = 'tblHkIbvRNOcx6lVQ';  // Fleet Management table

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

// Fill form from URL parameters
function fillFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const fields = ['Company','Date','Destination','Description','Phone','Address','PickUp','DropOff'];
  
  fields.forEach(field => {
    const value = params.get(field);
    if (value) {
      const el = document.querySelector(`[name="${field}"]`);
      if (el) {
        if (el.type === 'checkbox') {
          el.checked = (value.toLowerCase() === 'yes' || value === 'on');
        } else {
          el.value = decodeURIComponent(value.replace(/\+/g, ' '));
        }
      }
    }
  });
}

const form = document.getElementById('bookingForm');
const companyInput = document.getElementById('company');
const statusEl = document.getElementById('status');

// Auto‑fill today's date (native date input)
function initDatePicker() {
  const dateInput = document.getElementById('date-picker');
  if (dateInput && !dateInput.value) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
  }
}

// Run after DOM is ready
function init() {
  fillFromUrl();
  initDatePicker();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
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
    try {
      const uploaded = await Promise.all(attachments.map(uploadFile));
      fields.Attachments = uploaded.map(u => ({url:u}));
    } catch (err) {
      console.error('Upload error:', err);
    }
  }

  try {
    const apiKey = getApiKey();
    if (!apiKey) {
      statusEl.textContent = '❌ API key required';
      return;
    }
    
    const resp = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({fields})
    });
    
    if (!resp.ok) {
      const err = await resp.json();
      throw new Error(err.error?.message || `Airtable error ${resp.status}`);
    }
    
    await resp.json();
    statusEl.textContent = '✅ Job booked!';
    form.reset();
    initDatePicker();
  } catch (err) {
    console.error(err);
    statusEl.textContent = '❌ Failed: ' + err.message;
  }
});

// Helper - upload a file to Airtable's attachment endpoint
async function uploadFile(file) {
  const apiKey = getApiKey();
  const uploadResp = await fetch('https://api.airtable.com/v0/meta/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: file
  });
  if (!uploadResp.ok) throw new Error('Upload failed');
  const json = await uploadResp.json();
  return json.url;
}