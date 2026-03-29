#!/usr/bin/env python3
import http.server, socketserver, json, os, subprocess, datetime, re
from pathlib import Path
from urllib.parse import urlparse, parse_qs

WORKSPACE = Path.home() / ".openclaw" / "workspace"
PORT = 8080
BASE_DIR = Path(__file__).parent.resolve()

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BASE_DIR), **kwargs)

    def do_GET(self):
        if self.path == "/api/status":
            self.handle_api_status()
        elif self.path == "/api/todos":
            self.handle_api_todos()
        elif self.path == "/api/queue":
            self.handle_api_queue()
        elif self.path.startswith("/api/run?"):
            self.handle_api_run()
        else:
            super().do_GET()

    def handle_api_status(self):
        try:
            r = subprocess.run(["openclaw", "cron", "list", "--json"], capture_output=True, text=True, timeout=5)
            cron = json.loads(r.stdout) if r.returncode == 0 else {"jobs": []}
        except:
            cron = {"jobs": []}
        data = self.get_status()
        self.send_response(200)
        self.send_header("Content-type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def handle_api_run(self):
        qs = parse_qs(urlparse(self.path).query)
        cmd = qs.get("cmd", [""])[0]
        allowed = {
            "memory_sync": "bash ~/.openclaw/workspace/skills/memory-discipline/scripts/memory_sync.sh",
            "daily_digest": "bash ~/.openclaw/workspace/skills/monitoring/scripts/daily_status_report.py",
            "restart_dispatcher": 'crontab -l | grep -v "dispatcher" | crontab - ; openclaw cron add --name "Upgrade Dispatcher" --cron "*/15 * * * *" --tz "America/Los_Angeles" --session isolated --timeout-seconds 120 --message "bash ~/.openclaw/workspace/dispatch/dispatcher.sh"',
        }
        if cmd not in allowed:
            self.send_response(400); self.end_headers(); self.wfile.write(b'{"error":"unknown command"}'); return
        try:
            subprocess.Popen(allowed[cmd], shell=True)
            self.send_response(200); self.end_headers(); self.wfile.write(b'{"status":"started"}')
        except Exception as e:
            self.send_response(500); self.end_headers(); self.wfile.write(json.dumps({"error": str(e)}).encode())

    def handle_api_todos(self):
        mem_path = WORKSPACE / "MEMORY.md"
        if not mem_path.exists():
            self.send_response(200); self.end_headers(); self.wfile.write(json.dumps([]).encode()); return
        try:
            todos = []
            for line in mem_path.read_text().splitlines():
                m = re.search(r'\[todo\]\s*(.+)', line, re.IGNORECASE)
                if m:
                    todos.append(m.group(1).strip())
            self.send_response(200); self.end_headers(); self.wfile.write(json.dumps(todos).encode())
        except:
            self.send_response(200); self.end_headers(); self.wfile.write(json.dumps([]).encode())

    def handle_api_queue(self):
        queue_file = WORKSPACE / "dispatch" / "upgrade_queue.txt"
        if not queue_file.exists():
            self.send_response(200); self.end_headers(); self.wfile.write(json.dumps([]).encode()); return
        items = []
        for line in queue_file.read_text().splitlines():
            prefix = line.split()[0] if line.strip() else ""
            if prefix in ("TODO", "DOING", "DONE"):
                title = line[len(prefix):].strip()
                items.append({"status": prefix, "title": title})
        self.send_response(200); self.end_headers(); self.wfile.write(json.dumps(items).encode())

    def get_status(self):
        try:
            r = subprocess.run(["openclaw", "cron", "list", "--json"], capture_output=True, text=True, timeout=5)
            cron = json.loads(r.stdout) if r.returncode == 0 else {"jobs": []}
        except:
            cron = {"jobs": []}

        queue_file = WORKSPACE / "dispatch" / "upgrade_queue.txt"
        queue = {"total": 0, "todo": 0}
        if queue_file.exists():
            lines = queue_file.read_text().splitlines()
            queue["total"] = len([l for l in lines if l.startswith(("TODO","DOING","DONE"))])
            queue["todo"] = len([l for l in lines if l.startswith("TODO")])

        def tail_log(path, lines=20):
            p = WORKSPACE / path
            if p.exists():
                return p.read_text().splitlines()[-lines:]
            return []
        logs = {
            "dispatcher": tail_log("logs/dispatcher.log", 30),
            "cron_errors": tail_log("logs/cron_errors.log", 20)
        }

        try:
            last_commit = subprocess.check_output(["git", "-C", str(WORKSPACE), "log", "-1", "--oneline"], text=True).strip()
        except:
            last_commit = ""

        mem_dir = WORKSPACE / "memory"
        mem_files = len(list(mem_dir.glob("*.md"))) if mem_dir.exists() else 0

        # Compute health score (0-100)
        total_jobs = len(cron.get("jobs", []))
        ok_jobs = len([j for j in cron.get("jobs", []) if j.get("state", {}).get("lastRunStatus") == "ok"])
        cron_health = (ok_jobs / total_jobs * 100) if total_jobs else 0
        # TODO ratio: lower is better; health penalty if >10
        todo_ratio = queue["todo"] / max(queue["total"], 1)
        queue_health = max(0, 100 - (todo_ratio * 100))
        # Memory health: more files is good, but not excessive; consider 3+ healthy
        mem_health = min(100, mem_files * 33)
        # Weighted composite
        health_score = int(0.4*cron_health + 0.4*queue_health + 0.2*mem_health)
        health_score = max(0, min(100, health_score))

        return {
            "generated": datetime.datetime.now().isoformat(),
            "cron_jobs": cron.get("jobs", []),
            "dispatcher_queue": queue,
            "logs": logs,
            "git_last_commit": last_commit,
            "memory_daily_files": mem_files,
            "health_score": health_score,
            "cron_health_pct": cron_health,
            "queue_health_pct": queue_health,
            "mem_health_pct": mem_health
        }

if __name__ == "__main__":
    print(f"Wario Dashboard → http://localhost:{PORT}")
    print(f"Serving files from: {BASE_DIR}")
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        httpd.serve_forever()
