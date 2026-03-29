#!/usr/bin/env python3
import http.server, socketserver, json, os, subprocess, datetime
from pathlib import Path

WORKSPACE = Path.home() / ".openclaw" / "workspace"
PORT = 8080

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(Path(__file__).parent), **kwargs)

    def do_GET(self):
        if self.path in ("/", "/index.html"):
            return super().do_GET()
        if self.path == "/api/status":
            data = self.get_status()
            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(data).encode())
            return
        self.send_error(404)

    def get_status(self):
        # Cron health
        try:
            r = subprocess.run(["openclaw", "cron", "list", "--json"], capture_output=True, text=True, timeout=5)
            cron = json.loads(r.stdout) if r.returncode == 0 else {"jobs": []}
        except:
            cron = {"jobs": []}

        # Dispatcher queue
        queue_file = WORKSPACE / "dispatch" / "upgrade_queue.txt"
        queue = {"total": 0, "todo": 0}
        if queue_file.exists():
            lines = queue_file.read_text().splitlines()
            queue["total"] = len([l for l in lines if l.startswith(("TODO","DOING","DONE"))])
            queue["todo"] = len([l for l in lines if l.startswith("TODO")])

        # Recent logs
        def tail_log(path, lines=20):
            p = WORKSPACE / path
            if p.exists():
                return p.read_text().splitlines()[-lines:]
            return []
        logs = {
            "dispatcher": tail_log("logs/dispatcher.log", 30),
            "cron_errors": tail_log("logs/cron_errors.log", 20)
        }

        # Git last commit
        try:
            last_commit = subprocess.check_output(["git", "-C", str(WORKSPACE), "log", "-1", "--oneline"], text=True).strip()
        except:
            last_commit = ""

        # Memory stats
        mem_dir = WORKSPACE / "memory"
        mem_files = len(list(mem_dir.glob("*.md"))) if mem_dir.exists() else 0

        return {
            "generated": datetime.datetime.now().isoformat(),
            "cron_jobs": cron.get("jobs", []),
            "dispatcher_queue": queue,
            "logs": logs,
            "git_last_commit": last_commit,
            "memory_daily_files": mem_files
        }

if __name__ == "__main__":
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"Wario Dashboard → http://localhost:{PORT}")
        httpd.serve_forever()
