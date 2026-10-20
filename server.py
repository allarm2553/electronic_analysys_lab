#!/usr/bin/env python3
import http.server
import socketserver
import socket
import sys

def find_available_port(start_port=8000):
    if len(sys.argv) > 1:
        return int(sys.argv[1])
    for p in range(start_port, start_port + 20):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                s.bind(('0.0.0.0', p))
                return p
        except OSError:
            continue
    return start_port

PORT = find_available_port(8000)
BIND = "0.0.0.0"

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, format, *args):
        # Keep logs clean
        sys.stderr.write("%s - - [%s] %s\n" % (self.address_string(), self.log_date_time_string(), format % args))

if __name__ == '__main__':
    import os
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer((BIND, PORT), NoCacheHandler) as httpd:
        print("=" * 60)
        print("⚡ Electronic Analysis Lab Sheets Local Server")
        print("=" * 60)
        print(f"📡 Localhost:     http://localhost:{PORT}")
        print(f"📁 E-Lab 1 URL:   http://localhost:{PORT}/elab1-diode-sheet-app/")
        print("=" * 60)
        sys.stdout.flush()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
