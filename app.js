const API = '/api/status';

// Selection state for bulk operations
const selectedTitles = new Set();

// Theme handling
const themes = ['dark', 'light', 'solarized-dark', 'nord', 'catppuccin'];
let currentThemeIdx = themes.indexOf(localStorage.getItem('theme'));
if (currentThemeIdx === -1) currentThemeIdx = 0;
function applyTheme(idx) {
  currentThemeIdx = idx % themes.length;
  const theme = themes[currentThemeIdx];
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = theme === 'dark' ? '🌙' : '☀️';
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
  // Queue navigation: j/k
  if (e.key === 'j' || e.key === 'J') { e.preventDefault(); selectNext(); }
  if (e.key === 'k' || e.key === 'K') { e.preventDefault(); selectPrev(); }
});

// Toggle logs visibility
function toggleLogs() {
  const panel = document.getElementById('logsPanel');
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}
document.getElementById('closeLogs')?.addEventListener('click', () => {
  document.getElementById('logsPanel').style.display = 'none';
});

// Queue navigation
let selectedIndex = -1;
function selectQueueItem(idx) {
  const items = document.querySelectorAll('#queueContent .list-item');
  if (items.length === 0) { selectedIndex = -1; return; }
  selectedIndex = (idx + items.length) % items.length;
  items.forEach((item, i) => {
    const isSel = i === selectedIndex;
    item.classList.toggle('selected', isSel);
    const cb = item.querySelector('.bulk-check');
    if (cb) {
      cb.checked = isSel;
      if (isSel) selectedTitles.add(item.dataset.title);
      else selectedTitles.delete(item.dataset.title);
    }
  });
  if (selectedIndex >= 0) items[selectedIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
function selectNext() { const items = document.querySelectorAll('#queueContent .list-item'); if (items.length) selectQueueItem((selectedIndex + 1) % items.length); }
function selectPrev() { const items = document.querySelectorAll('#queueContent .list-item'); if (items.length) selectQueueItem(selectedIndex <= 0 ? items.length - 1 : selectedIndex - 1); }

// Run command via API
function runCmd(cmd) {
  fetch(`/api/run?cmd=${cmd}`).then(r => r.json()).then(d => {
    if (d.status === 'started') alert(`${cmd} started`);
    else alert(`Error: ${d.error||'unknown'}`);
  });
}

// Complete all TODOs
function completeAll() {
  if (!confirm('Mark all TODOs as DONE?')) return;
  fetch('/api/queue/complete_all', {method: 'POST'})
    .then(r => r.json())
    .then(d => {
      if (d.ok) {
        loadQueue();
        launchConfetti();
      } else {
        alert('Failed to complete all');
      }
    })
    .catch(err => {
      console.error(err);
      alert('Error completing all');
    });
}

// Escape HTML for safe attribute insertion
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Effort classification from title text
function classifyEffort(title) {
  const t = title.toLowerCase();
  if (/\b(quick|simple|fast|rapid|short|tiny)\b/.test(t)) return 'quick';
  if (/\b(medium|moderate|average|regular)\b/.test(t)) return 'medium';
  if (/\b(long|complex|extensive|heavy|big|large|time-consuming)\b/.test(t)) return 'long';
  return null;
}

// Render queue with effort badges and search filter
function renderQueue(items) {
  const filter = document.getElementById('queueSearch').value.toLowerCase();
  const qEl = document.getElementById('queueContent');
  let filtered = items.filter(it => it.title.toLowerCase().includes(filter));
  // Apply saved order if exists
  const savedOrder = localStorage.getItem('queueOrder');
  if (savedOrder) {
    const orderSet = new Set(savedOrder.split('|'));
    filtered.sort((a, b) => {
      const aIn = orderSet.has(a.title) ? 1 : 0;
      const bIn = orderSet.has(b.title) ? 1 : 0;
      if (!aIn && !bIn) return 0;
      if (aIn && !bIn) return 1;
      if (!aIn && bIn) return -1;
      return savedOrder.indexOf(a.title) - savedOrder.indexOf(b.title);
    });
  }
  if (filtered.length === 0) {
    qEl.textContent = 'No queue items.';
    return;
  }
  qEl.innerHTML = filtered.map(it => {
    const isDone = it.status === 'DONE';
    let icon = '';
    let style = '';
    if (it.status === 'TODO') {
      icon = '○'; style = 'color:var(--muted)';
    } else if (it.status === 'DOING') {
      icon = '◐'; style = 'color:var(--accent)';
    } else {
      icon = '✓'; style = 'color:var(--success)';
    }
    const doneAttr = isDone ? 'done="true"' : '';
    const effort = classifyEffort(it.title);
    const badge = effort ? `<span class="effort-badge effort-${effort}">${effort}</span>` : '';
    const isChecked = selectedTitles.has(it.title) ? 'checked' : '';
    return `<div class="list-item" data-title="${escapeHtml(it.title)}" draggable="true" ${doneAttr}>
      <input type="checkbox" class="bulk-check" ${isChecked} data-title="${escapeHtml(it.title)}" style="margin-right:0.5rem;">
      <span class="status-icon" style="${style}">${icon}</span><span>${it.title}</span>${badge}
    </div>`;
  }).join('');

  // Attach change listeners to checkboxes for selection
  document.querySelectorAll('#queueContent .bulk-check').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const title = e.target.dataset.title;
      if (e.target.checked) {
        selectedTitles.add(title);
        e.target.closest('.list-item').classList.add('selected');
      } else {
        selectedTitles.delete(title);
        e.target.closest('.list-item').classList.remove('selected');
      }
    });
  });

  // Sync checkboxes with selection set (from keyboard nav)
  document.querySelectorAll('#queueContent .list-item').forEach(item => {
    const title = item.dataset.title;
    const cb = item.querySelector('.bulk-check');
    if (cb) {
      cb.checked = selectedTitles.has(title);
      item.classList.toggle('selected', selectedTitles.has(title));
    }
  });

  // Drag and drop handlers
  let dragSrcEl = null;
  const items = document.querySelectorAll('#queueContent .list-item');
  items.forEach(item => {
    item.addEventListener('dragstart', (e) => {
      dragSrcEl = item;
      e.dataTransfer.effectAllowed = 'move';
      item.classList.add('dragging');
    });
    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const target = e.target.closest('.list-item');
      if (target && target !== dragSrcEl) {
        const rect = target.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        if (e.clientY < midpoint) {
          target.before(dragSrcEl);
        } else {
          target.after(dragSrcEl);
        }
      }
    });
    item.addEventListener('drop', (e) => {
      e.preventDefault();
      // Save new order to localStorage
      const all = Array.from(document.querySelectorAll('#queueContent .list-item')).map(li => li.dataset.title);
      localStorage.setItem('queueOrder', all.join('|'));
      item.classList.remove('dragging');
    });
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
    });
  });
}

function loadQueue() {
  fetch('/api/queue')
    .then(r => r.json())
    .then(items => renderQueue(items))
    .catch(() => { document.getElementById('queueContent').textContent = 'Failed to load queue.'; });
}

// Search filter listener
document.getElementById('queueSearch')?.addEventListener('input', () => loadQueue());

// Bulk actions
document.getElementById('selectAll')?.addEventListener('change', (e) => {
  const checkboxes = document.querySelectorAll('#queueContent .bulk-check');
  checkboxes.forEach(cb => {
    cb.checked = e.target.checked;
    const title = cb.dataset.title;
    if (e.target.checked) {
      selectedTitles.add(title);
      cb.closest('.list-item').classList.add('selected');
    } else {
      selectedTitles.delete(title);
      cb.closest('.list-item').classList.remove('selected');
    }
  });
});

document.getElementById('tagSelect')?.addEventListener('change', async (e) => {
  const tag = e.target.value;
  if (!tag) return;
  if (tag === 'custom') {
    const custom = prompt('Enter custom tag:');
    if (!custom) return;
    await applyTag(custom);
  } else {
    await applyTag(tag);
  }
  e.target.value = '';
});

async function applyTag(tag) {
  for (const title of selectedTitles) {
    try {
      await fetch('/api/queue/tag', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({title, tag})
      });
    } catch (err) {
      console.error('Tag failed for', title, err);
    }
  }
  // Refresh
  loadQueue();
}

function clearSelection() {
  selectedTitles.clear();
  document.querySelectorAll('#queueContent .bulk-check').forEach(cb => { cb.checked = false; });
  document.querySelectorAll('#queueContent .list-item').forEach(item => item.classList.remove('selected'));
}

// Confetti
let confettiCanvas = null, confettiCtx = null;
function launchConfetti() {
  if (localStorage.getItem('confettiEnabled') === 'false') return;
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

// Load all data
async function load() {
  try {
    const res = await fetch(API);
    const d = await res.json();
    renderStatus(d);
    loadQueue();
    renderCron(d.cron_jobs || []);
    renderTodos(d);
    renderLogs(d);
  } catch (e) {
    console.error(e);
    document.querySelectorAll('.list-content').forEach(el => el.textContent = 'Failed to load');
  }
}

function renderStatus(d) {
  document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString();
  const cronJobs = d.cron_jobs || [];
  const okCount = cronJobs.filter(j => j.state?.lastRunStatus === 'ok').length;
  document.getElementById('statCron').textContent = `${okCount}/${cronJobs.length}`;
  document.getElementById('statQueue').textContent = d.dispatcher_queue?.todo || 0;
  document.getElementById('statMemory').textContent = d.memory_daily_files || 0;
  document.getElementById('statCommits').textContent = d.git_last_commit ? '1' : '0';
  document.getElementById('statHealth').textContent = d.health_score !== undefined ? d.health_score + '%' : '—';
}

function renderCron(jobs) {
  const cronEl = document.getElementById('cronContent');
  cronEl.innerHTML = jobs.map(j => {
    const ok = j.state?.lastRunStatus === 'ok';
    const icon = ok ? '✅' : '❌';
    let ts = Number(j.state?.nextRunAtMs) || 0;
    // Detect if timestamp is in seconds (10-digit) and convert to ms
    if (ts > 1e9 && ts < 1e12) ts *= 1000;
    const when = ts > 0 ? new Date(ts).toLocaleDateString() : '—';
    return `<div class="list-item">
      <span class="status-icon">${icon}</span>
      <span>${j.name}</span>
      <span class="time-ago">next ${when}</span>
    </div>`;
  }).join('') || '<p>No cron jobs</p>';
}

function renderTodos(d) {
  const todoEl = document.getElementById('todoContent');
  fetch('/api/todos')
    .then(r => r.json())
    .then(todos => {
      if (todos.length === 0) todoEl.textContent = 'No todos.';
      todoEl.innerHTML = todos.map(t => `<div class="list-item">• ${t}</div>`).join('');
    })
    .catch(() => { todoEl.textContent = 'Unable to load todos.'; });
}

function renderLogs(d) {
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
