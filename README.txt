SAREE STORE

RUN ON YOUR COMPUTER (Windows)
1. Install Node.js (LTS) from https://nodejs.org
2. Open the folder with package.json and server.js in VS Code, open the terminal (Ctrl + ~)
3. npm install                      (first time only)
4. $env:PORT=4000; $env:ADMIN_PASSWORD="mypassword123"; node server.js
5. Shop: http://localhost:4000   Admin: http://localhost:4000/admin.html

YOUR DATA IS SAFE
Everything you add is saved in two folders: "data" and "public\uploads".
Stopping the server does not delete it. Back up both folders regularly.

PUT IT ONLINE FOR A CLIENT
Needs Node.js hosting with a permanent disk.
Environment variables to set on the host:
  ADMIN_PASSWORD = a strong password for that client
  DATA_DIR       = folder of the host's permanent disk (for example /var/data)
Build command: npm install      Start command: node server.js
