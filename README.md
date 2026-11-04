# Irfan Home Care Service

A free community care platform for Garissa.

- **Public website** (`public/`): "Request a medic" and "Request an ambulance" buttons that call 0728790921, a services list, and a request form.
- **Backend** (`server.js`): saves requests from the form and serves the coordinator API.
- **Coordinator dashboard** (`admin/`): password protected. You see new requests and choose which doctor to send.
- **No payments** anywhere.

## Run it on your computer (WSL / Linux / Mac / Windows)

1. Install Node.js 18 or newer (https://nodejs.org). Check with `node -v`.
2. In the project folder:

```bash
cd ~/irfanhomecareservice
npm install
cp .env.example .env
nano .env          # change ADMIN_PASSWORD to a long password
npm start
```

3. Open:
   - Website: http://localhost:3000
   - Coordinator dashboard: http://localhost:3000/admin/ (log in with `ADMIN_USER` and `ADMIN_PASSWORD` from `.env`)

## Folder layout

```
server.js        backend (Express)
public/          the website people see
admin/           the coordinator dashboard
data/db.json     requests and doctors (created automatically)
.env             your password (never share or upload this)
```

## Putting it online

GitHub Pages cannot run the backend. Use a host that runs Node.js, for example Render, Railway, Fly.io or a small VPS.

- Set `ADMIN_PASSWORD` (and `ADMIN_USER`) as environment variables on the host.
- Use HTTPS (hosts above provide it). The dashboard login is sent with every request, so never use it over plain HTTP on the internet.
- Keep `data/` on a persistent disk or volume, or the saved requests are lost when the host restarts.
- Back up `data/db.json` regularly.

## Privacy

Requests contain names, phone numbers and health details. Keep the dashboard password private, ask only for what you need, delete old requests you no longer need, and follow Kenya's Data Protection Act (consider registering with the Office of the Data Protection Commissioner).

## Customise

- Phone number: search for `0728790921` in `public/` and `server.js`.
- Doctors: add and remove them in the dashboard.
- Text and look: `public/index.html` and `public/style.css`.
