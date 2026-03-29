// Wario Dashboard app
const API = '/api/status';

// Theme toggle
const themeBtn = document.getElementById('themeToggle');
const saved = localStorage.getItem('theme');
if (saved) document.documentElement.setAttribute('data-theme', saved);
themeBtn.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
});

async function load() {
  try {
    const res = await fetch(API);
    const data = await res.json();
    render(data);
  } catch (e) {
    console.error(e);
    document.querySelectorAll('.loading').forEach(el => {
      el.textContent = 'Failed to load – is server running?';
    });
  }
}

function render(d) {
  document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString();

  // Cron Health
  const cronContainer = document.querySelector('#cronHealth .loading').parentElement;
  const jobs = d.cron_jobs || [];
  if (jobs.length === 0) {
    cronContainer.innerHTML = '<p class="muted">No cron jobs found.</p>';
  } else {
    cronContainer.innerHTML = `<div class="job-list">
      ${jobs.map(job => {
        const ok = job.state?.lastRunStatus === 'ok';
        const icon = ok ? '✅' : '❌';
        const name = job.name || '?';
        const lastMs = job.state?.lastRunAtMs || 0;
        const last = lastMs ? new Date(parseInt(lastMs)/1000).toLocaleString() : 'never';
        return `<div class="job-row">
          <span class="status-icon">${icon}</span>
          <span class="job-name">${name}</span>
          <span class="job-meta">last: ${last}</span>
        </div>`;
      }).join('')}
    </div>`;
  }

  // Dispatcher Queue
  const q = d.dispatcher_queue || {};
  document.querySelector('#queueStatus .loading').replaceWith(
    `<div>
      <p>Backlog: <strong>${q.todo || 0}</strong> of ${q.total || 0} tasks remaining</p>
      <p class="muted">Dispatcher runs every 15 min</p>
    </div>`
  );

  // Recent Logs
  const logs = d.logs || {};
  const logHtml = ['dispatcher', 'cron_errors'].map(type => {
    const lines = logs[type] || [];
    return `<h3 style="text-transform:capitalize;margin:0.5rem 0 0.2rem;">${type}</h3><pre>${lines.join('\n') || '(empty)'}</pre>`;
  }).join('');
  document.querySelector('#systemInfo .loading').replaceWith(`
    <div class="logview">
      ${logHtml}
    </div>
  `);

  // System Info
  const mem = d.memory || {};
  document.getElementById('systemInfo').insertAdjacentHTML('beforeend',
    `<p>Daily memory files: ${mem.daily_files || 0}</p>
     <p>Git: <code class="mono">${d.git_last_commit || 'no commits'}</code></p>`
  );
}

// Refresh every 60s
setInterval(load, 60000);
load();
