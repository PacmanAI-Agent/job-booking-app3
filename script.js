// ==== CONFIG - Airtable details ====
const BASE_ID       = 'appX0OtnSWt8JOKvh';
const TABLE_ID      = 'tblHkIbvRNOcx6lVQ';  // Fleet Management table

// ====================================================

// Get API key from input field or localStorage
function getApiKey() {
  let apiKeyInput = document.getElementById('apiKey');
  if (!apiKeyInput) {
    apiKeyInput = document.querySelector('input#apiKey');
  }
  if (!apiKeyInput) {
    apiKeyInput = document.querySelector('input[type="text"]');
  }
  
  let apiKey = '';
  if (apiKeyInput && apiKeyInput.value) {
    apiKey = apiKeyInput.value.trim();
    localStorage.setItem('airtable_api_key', apiKey);
  }
  
  if (!apiKey) {
    apiKey = localStorage.getItem('airtable_api_key') || '';
  }
  
  return apiKey;
}

// Fill form from URL parameters
function fillFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const fields = ['Company','Date','Name','Description','Phone','Pick Up Address','Drop Off Address','PickUp','DropOff'];
  
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
  
  // Get first (main) job - map to correct Airtable field names
  const mainDest = document.querySelector('[name="Name"]')?.value || document.querySelector('[name="Destination"]')?.value;
  const mainDesc = document.querySelector('[name="Description"]')?.value;
  const mainPhone = document.querySelector('[name="Phone"]')?.value;
  const mainAddr = document.querySelector('[name="Address"]')?.value;
  const mainPickUp = document.querySelector('[name="PickUp"]')?.checked;
  const mainDropOff = document.querySelector('[name="DropOff"]')?.checked;
  
  if (mainDest) {
    // Determine status based on checkboxes
    let status = 'Todo';
    if (mainPickUp && mainDropOff) status = 'Pick up + Drop off';
    else if (mainPickUp) status = 'Pick up';
    else if (mainDropOff) status = 'Drop off';
    
    jobs.push({
      Name: mainDest,
      Description: mainDesc + (mainPhone ? '\nPhone: ' + mainPhone : ''),
      'Pick Up Address': mainAddr,
      'Pick up Date': date,
      Status: status,
      Company: company
    });
  }
  
  // Get additional jobs
  for (let i = 2; i <= jobCount; i++) {
    const jobDiv = document.getElementById('job-' + i);
    if (jobDiv) {
      const dest = jobDiv.querySelector(`[name="Name_${i}"]`)?.value || jobDiv.querySelector(`[name="Destination_${i}"]`)?.value;
      if (dest) {
        const desc = jobDiv.querySelector(`[name="Description_${i}"]`)?.value;
        const phone = jobDiv.querySelector(`[name="Phone_${i}"]`)?.value;
        const addr = jobDiv.querySelector(`[name="Address_${i}"]`)?.value;
        const pickup = jobDiv.querySelector(`[name="PickUp_${i}"]`)?.checked;
        const dropoff = jobDiv.querySelector(`[name="DropOff_${i}"]`)?.checked;
        
        let status = 'Todo';
        if (pickup && dropoff) status = 'Pick up + Drop off';
        else if (pickup) status = 'Pick up';
        else if (dropoff) status = 'Drop off';
        
        jobs.push({
          Name: dest,
          Description: desc + (phone ? '\nPhone: ' + phone : ''),
          'Pick Up Address': addr,
          'Pick up Date': date,
          Status: status,
          Company: company
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
      document.getElementById('jobs-container').innerHTML = getJob1HTML();
      jobCount = 1;
      initDatePicker();
    })
    .catch(err => {
      statusEl.textContent = '❌ Failed: ' + err.message;
    });
}

function getJob1HTML() {
  return `<div class="job-entry" id="job-1">
<label>Destination</label>
<input type="text" name="Name" placeholder="e.g. 123 Main St" required>

<label>Description</label>
<textarea name="Description" rows="2" placeholder="Job details" required></textarea>

<label>Phone (optional)</label>
<input type="tel" name="Phone" placeholder="e.g. 022 370 3540">

<label>Address (optional)</label>
<input type="text" name="Address" placeholder="e.g. Suite 5, 456 Oak Ave">

<div class="checkboxes">
<label><input type="checkbox" name="PickUp" value="Yes"> Pick-up</label>
<label><input type="checkbox" name="DropOff" value="Yes"> Drop-off</label>
</div>

<label>Attachments</label>
<input type="file" name="Attachments" accept="image/*,application/pdf" multiple>
</div>`;
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
    <input type="text" name="Name_${jobCount}" placeholder="e.g. 123 Main St" required>
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