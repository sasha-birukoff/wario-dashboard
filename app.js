const API = '/api/status';

// Theme handling
const themes = ['dark', 'light', 'solarized-dark', 'nord', 'catppuccin'];
let currentThemeIdx = themes.indexOf(localStorage.getItem('theme')) || 0;
function applyTheme(idx) {
  currentThemeIdx = idx % themes.length;
  const theme = themes[currentThemeIdx];
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  if (document.getElementById('themeToggle')) {
    document.getElementById('themeToggle').textContent = theme === 'dark' ? '🌙' : '☀️';
  }
}
applyTheme(currentThemeIdx);
document.getElementById('themeToggle')?.addEventListener('click', () => applyTheme(currentThemeIdx + 1));

// Help modal
function openHelp() { document.getElementById('helpModal').style.display = 'flex'; }
function closeHelp() { document.getElementById('helpModal').style.display = 'none'; }

// Keyboard shortcuts
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key === '?') { e.preventDefault(); openHelp(); }
  if (e.key === 'r' || e.key === 'R') load();
  if (e.key === 't' || e.key === 'T') applyTheme(currentThemeIdx + 1);
  if (e.key === 'Escape') closeHelp();
});

// Toggle logs visibility
function toggleLogs() {
  const panel = document.getElementById('logsPanel');
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}
document.getElementById('closeLogs')?.addEventListener('click', () => {
  document.getElementById('logsPanel').style.display = 'none';
});

// Run command via API
function runCmd(cmd) {
  fetch(`/api/run?cmd=${cmd}`).then(r => r.json()).then(d => {
    if (d.status === 'started') alert(`${cmd} started`);
    else alert(`Error: ${d.error||'unknown'}`);
  });
}

// Confetti (lightweight canvas)
let confettiCanvas = null, confettiCtx = null;
function launchConfetti() {
  if (!confettiCanvas) {
    confettiCanvas = document.createElement('canvas');
    confettiCanvas.id = 'confetti-canvas';
    document.body.appendChild(confettiCanvas);
    confettiCtx = confettiCanvas.getContext('2d');
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
  }
  const pieces = [];
  const colors = ['#3b82f6','#22c55e','#f59e0b','#ef4444','#8b5cf6'];
  for (let i = 0; i < 150; i++) {
    pieces.push({
      x: Math.random() * confettiCanvas.width,
      y: Math.random() * confettiCanvas.height - confettiCanvas.height,
      color: colors[Math.floor(Math.random()*colors.length)],
      size: Math.random()*8+4,
      speed: Math.random()*3+2,
      wobble: Math.random()*2-1
    });
  }
  let anim = () => {
    confettiCtx.clearRect(0,0,confettiCanvas.width,confettiCanvas.height);
    let active = false;
    pieces.forEach(p => {
      p.y += p.speed;
      p.x += p.wobble;
      if (p.y < confettiCanvas.height) active = true;
      confettiCtx.fillStyle = p.color;
      confettiCtx.fillRect(p.x, p.y, p.size, p.size);
    });
    if (active) requestAnimationFrame(anim);
    else confettiCanvas.remove();
  };
  anim();
}

// Data loading
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
  document.getElementById('statCommits').textContent = d.git_last_commit ? '1' : '0';
  document.getElementById('statHealth').textContent = d.health_score !== undefined ? d.health_score + '%' : '—';

  // Dispatcher queue list
  fetch('/api/queue')
    .then(r => r.json())
    .then(items => {
      const qEl = document.getElementById('queueContent');
      if (items.length === 0) qEl.textContent = 'No queue items.';
      qEl.innerHTML = items.map(it => {
        let icon = '';
        let style = '';
        let done = it.status === 'DONE';
        if (it.status === 'TODO') { icon = '○'; style = 'color:var(--muted)'; }
        else if (it.status === 'DOING') { icon = '◐'; style = 'color:var(--accent)'; }
        else { icon = '✓'; style = 'color:var(--success)'; }
        return `<div class="list-item" ${done ? 'done="true"' : ''}><span class="status-icon" style="${style}">${icon}</span><span>${it.title}</span></div>`;
      }).join('');
      // Confetti if all DONE
      if (items.length > 0 && items.every(it => it.status === 'DONE') && localStorage.getItem('confettiEnabled') !== 'false') {
        launchConfetti();
      }
    })
    .catch(() => { document.getElementById('queueContent').textContent = 'Failed to load queue.'; });

  // Cron health list
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

  // To-Do list from MEMORY
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

setInterval(load, 60000);
load();
