// ==== CONFIG - Airtable details ====
const BASE_ID       = 'appX0OtnSWt8JOKvh';
const TABLE_ID      = 'tblHkIbvRNOcx6lVQ';

// ====================================================

function getApiKey() {
  let apiKeyInput = document.getElementById('apiKey');
  if (!apiKeyInput) apiKeyInput = document.querySelector('input#apiKey');
  if (!apiKeyInput) apiKeyInput = document.querySelector('input[type="text"]');
  
  let apiKey = '';
  if (apiKeyInput && apiKeyInput.value) {
    apiKey = apiKeyInput.value.trim();
    localStorage.setItem('airtable_api_key', apiKey);
  }
  if (!apiKey) apiKey = localStorage.getItem('airtable_api_key') || '';
  return apiKey;
}

function initDatePicker() {
  const dateInput = document.getElementById('date-picker');
  if (dateInput && !dateInput.value) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }
}

function init() {
  initDatePicker();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

function bookAllJobs() {
  const statusEl = document.getElementById('status');
  const apiKey = getApiKey();
  
  if (!apiKey) {
    statusEl.textContent = '⚠️ Enter your Airtable API key';
    return;
  }
  
  statusEl.textContent = 'Sending...';
  
  const date = document.getElementById('date-picker').value;
  const company = document.getElementById('company').value;
  
  // Get job values - map to Airtable field names
  const name = document.querySelector('[name="Name"]')?.value;
  const desc = document.querySelector('[name="Description"]')?.value;
  const phone = document.querySelector('[name="Phone"]')?.value;
  const addr = document.querySelector('[name="Address"]')?.value;
  const pickup = document.querySelector('[name="PickUp"]')?.checked;
  const dropoff = document.querySelector('[name="DropOff"]')?.checked;
  
  if (!name) {
    statusEl.textContent = '⚠️ Enter destination';
    return;
  }
  
  // Build status from checkboxes
  let status = 'Todo';
  if (pickup && dropoff) status = 'Pick up + Drop off';
  else if (pickup) status = 'Pick up';
  else if (dropoff) status = 'Drop off';
  
  // Build description with phone if provided
  let fullDesc = desc || '';
  if (phone) fullDesc += (fullDesc ? '\n' : '') + 'Phone: ' + phone;
  
  const fields = {
    Name: name,
    Description: fullDesc,
    'Pick Up Address': addr,
    'Pick up Date': date,
    Status: status,
    Company: company
  };
  
  submitJob(fields, apiKey)
    .then(() => {
      statusEl.textContent = '✅ Job booked!';
      document.getElementById('bookingForm').reset();
      initDatePicker();
    })
    .catch(err => {
      statusEl.textContent = '❌ ' + err.message;
    });
}

async function submitJob(fields, apiKey) {
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
    throw new Error(err.error?.message || `Error ${resp.status}`);
  }
  return resp.json();
}