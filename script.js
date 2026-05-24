// ==== CONFIG - Airtable details ====
const BASE_ID       = 'appX0OtnSWt8JOKvh';
const TABLE_ID      = 'tblHkIbvRNOcx6lVQ';  // Fleet Management table

// ====================================================

// Get API key from input field or localStorage
function getApiKey() {
  // Try to find input field - check multiple ways
  let apiKeyInput = document.getElementById('apiKey');
  if (!apiKeyInput) {
    apiKeyInput = document.querySelector('input#apiKey');
  }
  if (!apiKeyInput) {
    apiKeyInput = document.querySelector('input[type="password"]');
  }
  
  let apiKey = '';
  if (apiKeyInput && apiKeyInput.value) {
    apiKey = apiKeyInput.value.trim();
    // Save to localStorage
    localStorage.setItem('airtable_api_key', apiKey);
  }
  
  // If still empty, check localStorage
  if (!apiKey) {
    apiKey = localStorage.getItem('airtable_api_key') || '';
  }
  
  return apiKey;
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
  if (attachments.length && attachments[0].name) {
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
      statusEl.textContent = '⚠️ Enter your Airtable API key below and try again';
      document.getElementById('apiKey').focus();
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
      if (err.error?.type === 'AUTHENTICATION_REQUIRED') {
        statusEl.textContent = '⚠️ Invalid API key. Clear saved key and re-enter below.';
        localStorage.removeItem('airtable_api_key');
        document.getElementById('apiKey').value = '';
        return;
      }
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

// Multi-job support
let jobCount = 1;

function addJob() {
  jobCount++;
  const container = document.getElementById('jobs-container');
  const jobDiv = document.createElement('div');
  jobDiv.className = 'job-entry';
  jobDiv.id = 'job-' + jobCount;
  jobDiv.innerHTML = `
    <hr>
    <h3>Job #${jobCount}</h3>
    <button type="button" class="remove-btn" onclick="removeJob(${jobCount})">Remove</button>
    <label>Destination</label>
    <input type="text" name="Destination_${jobCount}" placeholder="e.g. 123 Main St" required>
    <label>Description</label>
    <textarea name="Description_${jobCount}" rows="2" placeholder="Job details" required></textarea>
    <label>Phone (optional)</label>
    <input type="tel" name="Phone_${jobCount}" placeholder="e.g. 022 370 3540">
    <label>Address (optional)</label>
    <input type="text" name="Address_${jobCount}" placeholder="e.g. Suite 5, 456 Oak Ave">
    <div class="checkboxes">
      <label><input type="checkbox" name="PickUp_${jobCount}" value="Yes"> Pick-up</label>
      <label><input type="checkbox" name="DropOff_${jobCount}" value="Yes"> Drop-off</label>
    </div>
    <label>Attachments</label>
    <input type="file" name="Attachments_${jobCount}" accept="image/*,application/pdf" multiple>
  `;
  container.appendChild(jobDiv);
}

function removeJob(num) {
  const job = document.getElementById('job-' + num);
  if (job) job.remove();
}

function bookAllJobs() {
  const statusEl = document.getElementById('status');
  const apiKey = getApiKey();
  
  if (!apiKey) {
    statusEl.textContent = '⚠️ Enter your Airtable API key below and try again';
    return;
  }
  
  statusEl.textContent = 'Sending...';
  
  const date = document.getElementById('date-picker').value;
  const company = document.getElementById('company').value;
  const jobs = [];
  
  // Get first (main) job
  const mainDest = document.querySelector('[name="Destination"]')?.value;
  const mainDesc = document.querySelector('[name="Description"]')?.value;
  const mainPhone = document.querySelector('[name="Phone"]')?.value;
  const mainAddr = document.querySelector('[name="Address"]')?.value;
  const mainPickUp = document.querySelector('[name="PickUp"]')?.checked;
  const mainDropOff = document.querySelector('[name="DropOff"]')?.checked;
  
  if (mainDest) {
    jobs.push({
      Destination: mainDest,
      Description: mainDesc,
      Phone: mainPhone,
      Address: mainAddr,
      Date: date,
      Company: company,
      PickUp: mainPickUp ? 'Yes' : 'No',
      DropOff: mainDropOff ? 'Yes' : 'No'
    });
  }
  
  // Get additional jobs
  for (let i = 2; i <= jobCount; i++) {
    const jobDiv = document.getElementById('job-' + i);
    if (jobDiv) {
      const dest = jobDiv.querySelector(`[name="Destination_${i}"]`)?.value;
      if (dest) {
        jobs.push({
          Destination: dest,
          Description: jobDiv.querySelector(`[name="Description_${i}"]`)?.value,
          Phone: jobDiv.querySelector(`[name="Phone_${i}"]`)?.value,
          Address: jobDiv.querySelector(`[name="Address_${i}"]`)?.value,
          Date: date,
          Company: company,
          PickUp: jobDiv.querySelector(`[name="PickUp_${i}"]`)?.checked ? 'Yes' : 'No',
          DropOff: jobDiv.querySelector(`[name="DropOff_${i}"]`)?.checked ? 'Yes' : 'No'
        });
      }
    }
  }
  
  if (jobs.length === 0) {
    statusEl.textContent = '⚠️ Fill in at least one job';
    return;
  }
  
  Promise.all(jobs.map(job => submitJob(job, apiKey)))
    .then(() => {
      statusEl.textContent = `✅ ${jobs.length} job(s) booked!`;
      form.reset();
      // Remove extra jobs
      document.getElementById('jobs-container').innerHTML = '';
      jobCount = 1;
      initDatePicker();
    })
    .catch(err => {
      statusEl.textContent = '❌ Failed: ' + err.message;
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
    throw new Error(err.error?.message || `Airtable error ${resp.status}`);
  }
  return resp.json();
}