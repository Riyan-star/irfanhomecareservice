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

## Deploy for free

This app can use PostgreSQL in production and keeps the JSON file for local development. The included `render.yaml` configures a free Render web service. A free Supabase PostgreSQL project can provide the database; free plans have limits and may pause when inactive, so check the current terms before relying on them.

1. Push this project to a **private** GitHub repository. Do not add `.env` or `data/db.json`; both are ignored by Git.
2. Create a PostgreSQL project in Supabase. Copy its connection string from the database settings. Use a session-pooler connection string if the direct connection is not reachable from Render.
3. In Render, choose **New + > Blueprint**, connect the private repository, and apply the `render.yaml` blueprint.
4. Enter the requested `ADMIN_PASSWORD` and `DATABASE_URL` values in Render. Make the admin password long and unique. Do not put either secret in GitHub or in frontend code.
5. After deployment, open the Render URL. The public website is at `/`; the coordinator dashboard is at `/admin/`.

The production server refuses to start without `DATABASE_URL`, so it will not silently store live requests on Render's temporary filesystem. Existing records in local `data/db.json` are **not** copied to the hosted database; the hosted database starts with the default doctor. Keep the local file private and make a deliberate, secure migration only if those records must be retained.

Requests include personal and care-related information. A free hosting plan is not a guarantee of suitability for sensitive health data. Before accepting real requests, review the host/database terms, access controls, backups, retention, and applicable privacy requirements. GitHub Pages alone cannot run this backend.

## Privacy

Requests contain names, phone numbers and health details. Keep the dashboard password private, ask only for what you need, delete old requests you no longer need, and follow Kenya's Data Protection Act (consider registering with the Office of the Data Protection Commissioner).

## Customise

- Phone number: search for `0728790921` in `public/` and `server.js`.
- Doctors: add and remove them in the dashboard.
- Text and look: `public/index.html` and `public/style.css`.
