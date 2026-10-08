#!/usr/bin/env python3
import http.server
import socketserver
import sys

PORT = 8000
BIND = "127.0.0.1"

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
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer((BIND, PORT), NoCacheHandler) as httpd:
        print(f"Serving HTTP with NO-CACHE on {BIND}:{PORT}...")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
