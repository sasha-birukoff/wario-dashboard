const API = '/api/status';

const themeBtn = document.getElementById('themeToggle');
const saved = localStorage.getItem('theme');
if (saved) document.documentElement.setAttribute('data-theme', saved);
themeBtn.addEventListener('click', () => {
  const cur = document.documentElement.getAttribute('data-theme') || 'light';
  const nxt = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', nxt);
  localStorage.setItem('theme', nxt);
});

async function load() {
  try {
    const res = await fetch(API);
    const d = await res.json();
    render(d);
  } catch (e) {
    console.error(e);
    document.querySelectorAll('.list-content').forEach(el => el.textContent = 'Failed to load');
  }
}

function render(d) {
  document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString();

  // Stats
  const cronJobs = d.cron_jobs || [];
  const okCount = cronJobs.filter(j => j.state?.lastRunStatus === 'ok').length;
  document.getElementById('statCron').textContent = `${okCount}/${cronJobs.length}`;
  document.getElementById('statQueue').textContent = d.dispatcher_queue?.todo || 0;
  document.getElementById('statMemory').textContent = d.memory_daily_files || 0;
  document.getElementById('statCommits').textContent = d.git_last_commit ? '1' : '0'; // simplistic

  // Dispatcher queue list (fetch full queue)
  fetch('/api/queue')
    .then(r => r.json())
    .then(items => {
      const qEl = document.getElementById('queueContent');
      if (items.length === 0) qEl.textContent = 'No queue items.';
      qEl.innerHTML = items.map(it => {
        let icon = '';
        let style = '';
        let done = it.status === 'DONE' ? 'true' : 'false';
        if (it.status === 'TODO') {
          icon = '○'; style = 'color:var(--muted)';
        } else if (it.status === 'DOING') {
          icon = '◐'; style = 'color:var(--accent)';
        } else { // DONE
          icon = '✓'; style = 'color:var(--success)';
        }
        return `<div class="list-item" done="${done}"><span class="status-icon" style="${style}">${icon}</span><span>${it.title}</span></div>`;
      }).join('');
    })
    .catch(() => { document.getElementById('queueContent').textContent = 'Failed to load queue.'; });

  // Cron health simple list
  const cronEl = document.getElementById('cronContent');
  cronEl.innerHTML = cronJobs.map(j => {
    const ok = j.state?.lastRunStatus === 'ok';
    const icon = ok ? '✅' : '❌';
    const nextMs = j.state?.nextRunAtMs || 0;
    const when = nextMs > 0 ? new Date(nextMs/1000).toLocaleDateString() : '—';
    return `<div class="list-item">
      <span class="status-icon">${icon}</span>
      <span>${j.name}</span>
      <span class="time-ago">next ${when}</span>
    </div>`;
  }).join('') || '<p>No cron jobs</p>';

  // To‑Do: read latest memory file and extract [todo] bullets
  const todoEl = document.getElementById('todoContent');
  fetch('/api/todos')
    .then(r => r.json())
    .then(todos => {
      if (todos.length === 0) todoEl.textContent = 'No todos.';
      todoEl.innerHTML = todos.map(t => `<div class="list-item">• ${t}</div>`).join('');
    })
    .catch(() => { todoEl.textContent = 'Unable to load todos.'; });

  // Logs viewer
  const logsEl = document.getElementById('logsContent');
  if (logsEl) {
    const allLines = [...(d.logs?.dispatcher || []), ...[].concat(d.logs?.cron_errors || [])];
    logsEl.innerHTML = allLines.map(l => {
      let cls = '';
      if (/ERROR|FAIL|Exception|Traceback/.test(l)) cls = 'log-error';
      else if (/WARN|WARNING|warn/.test(l)) cls = 'log-warn';
      return `<span class="log-line ${cls}">${l}</span>`;
    }).join('\n');
    logsEl.scrollTop = logsEl.scrollHeight;
  }
}

function toggleLogs() {
  const panel = document.getElementById('logsPanel');
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

document.getElementById('closeLogs')?.addEventListener('click', () => {
  document.getElementById('logsPanel').style.display = 'none';
});

function runCmd(cmd) {
  fetch(`/api/run?cmd=${cmd}`).then(r => r.json()).then(d => {
    if (d.status === 'started') alert(`${cmd} started`);
    else alert(`Error: ${d.error||'unknown'}`);
  });
}

setInterval(load, 60000);
load();
