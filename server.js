"use strict";

const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

/* ---------- Settings (from .env or the environment) ---------- */
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

const PORT = Number(process.env.PORT) || 3000;
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

if (ADMIN_PASSWORD.length < 8) {
  console.error(
    "\nSet ADMIN_PASSWORD (at least 8 characters) in a .env file before starting.\n" +
      "Copy .env.example to .env and edit it.\n"
  );
  process.exit(1);
}

/* ---------- Tiny JSON database ---------- */
const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");
fs.mkdirSync(DATA_DIR, { recursive: true });

function freshDb() {
  return {
    nextRequestId: 1,
    nextDoctorId: 2,
    doctors: [{ id: 1, name: "Dr. Ibrahim", phone: "0728790921", available: true }],
    requests: [],
  };
}

let db;
try {
  db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
} catch {
  db = freshDb();
  saveDb();
}

function saveDb() {
  const tmp = DB_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

/* ---------- Helpers ---------- */
const WHO = ["a child", "an adult", "an older person"];
const NEED = [
  "daily special needs care",
  "home nursing",
  "care after surgery",
  "advice on what care is needed",
];
const STATUSES = ["new", "assigned", "done", "cancelled"];

const clean = (value, max) =>
  String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);

const sha = (s) => crypto.createHash("sha256").update(String(s)).digest();

function adminAuth(req, res, next) {
  const header = req.headers.authorization || "";
  if (header.startsWith("Basic ")) {
    const decoded = Buffer.from(header.slice(6), "base64").toString();
    const i = decoded.indexOf(":");
    const user = decoded.slice(0, i);
    const pass = decoded.slice(i + 1);
    const okUser = crypto.timingSafeEqual(sha(user), sha(ADMIN_USER));
    const okPass = crypto.timingSafeEqual(sha(pass), sha(ADMIN_PASSWORD));
    if (okUser && okPass) return next();
  }
  res
    .set("WWW-Authenticate", 'Basic realm="Irfan coordinator", charset="UTF-8"')
    .status(401)
    .send("Login required");
}

// Allow at most 5 public requests per IP every 10 minutes.
const hits = new Map();
function limitPublic(req, res, next) {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const list = (hits.get(req.ip) || []).filter((t) => now - t < windowMs);
  if (list.length >= 5) {
    return res.status(429).json({
      error: "Too many requests. Please call 0728790921 if this is urgent.",
    });
  }
  list.push(now);
  hits.set(req.ip, list);
  next();
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, list] of hits) {
    if (!list.some((t) => now - t < 10 * 60 * 1000)) hits.delete(ip);
  }
}, 30 * 60 * 1000).unref();

/* ---------- App ---------- */
const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(express.json({ limit: "20kb" }));

app.use((req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Content-Security-Policy":
      "default-src 'self'; style-src 'self' https://fonts.googleapis.com; " +
      "font-src https://fonts.gstatic.com; img-src 'self' data:; " +
      "script-src 'self'; connect-src 'self'; frame-ancestors 'none'; form-action 'self'",
  });
  next();
});

app.get("/api/health", (req, res) => res.json({ ok: true }));

/* ----- Public: a community member sends a request ----- */
app.post("/api/requests", limitPublic, (req, res) => {
  const b = req.body || {};

  if (clean(b.website, 100)) return res.json({ ok: true }); // spam trap

  const name = clean(b.name, 80);
  const phone = clean(b.phone, 20);
  const area = clean(b.area, 120);
  const who = clean(b.who, 40);
  const need = clean(b.need, 60);
  const details = clean(b.details, 600);

  const errors = [];
  if (name.length < 2) errors.push("Please enter your name.");
  if (!/^\+?[0-9 ]{9,15}$/.test(phone)) errors.push("Please enter a valid phone number.");
  if (area.length < 2) errors.push("Please enter the area or village.");
  if (!WHO.includes(who)) errors.push("Please choose who needs care.");
  if (!NEED.includes(need)) errors.push("Please choose what help is needed.");
  if (b.consent !== true) errors.push("Please agree that we may contact you.");
  if (errors.length) return res.status(400).json({ error: errors.join(" ") });

  const request = {
    id: db.nextRequestId++,
    createdAt: new Date().toISOString(),
    name, phone, area, who, need, details,
    status: "new",
    doctorId: null,
    visit: "",
  };
  db.requests.push(request);
  saveDb();
  res.status(201).json({ ok: true, id: request.id });
});

/* ----- Coordinator (password protected) ----- */
const admin = express.Router();
admin.use(adminAuth);

admin.get("/requests", (req, res) => {
  res.json({
    requests: [...db.requests].reverse(),
    doctors: db.doctors,
  });
});

admin.patch("/requests/:id", (req, res) => {
  const request = db.requests.find((r) => r.id === Number(req.params.id));
  if (!request) return res.status(404).json({ error: "Request not found." });

  const b = req.body || {};

  if ("doctorId" in b) {
    if (b.doctorId === null || b.doctorId === "") {
      request.doctorId = null;
    } else {
      const doctor = db.doctors.find((d) => d.id === Number(b.doctorId));
      if (!doctor) return res.status(400).json({ error: "Doctor not found." });
      request.doctorId = doctor.id;
      if (request.status === "new") request.status = "assigned";
    }
  }
  if ("visit" in b) request.visit = clean(b.visit, 60);
  if ("status" in b) {
    if (!STATUSES.includes(b.status)) {
      return res.status(400).json({ error: "Invalid status." });
    }
    request.status = b.status;
  }
  saveDb();
  res.json({ ok: true, request });
});

admin.post("/doctors", (req, res) => {
  const name = clean(req.body?.name, 80);
  const phone = clean(req.body?.phone, 20);
  if (name.length < 2) return res.status(400).json({ error: "Enter the doctor's name." });
  if (phone && !/^\+?[0-9 ]{9,15}$/.test(phone)) {
    return res.status(400).json({ error: "Enter a valid phone number." });
  }
  const doctor = { id: db.nextDoctorId++, name, phone, available: true };
  db.doctors.push(doctor);
  saveDb();
  res.status(201).json({ ok: true, doctor });
});

admin.patch("/doctors/:id", (req, res) => {
  const doctor = db.doctors.find((d) => d.id === Number(req.params.id));
  if (!doctor) return res.status(404).json({ error: "Doctor not found." });
  if (typeof req.body?.available === "boolean") doctor.available = req.body.available;
  saveDb();
  res.json({ ok: true, doctor });
});

admin.delete("/doctors/:id", (req, res) => {
  const id = Number(req.params.id);
  db.doctors = db.doctors.filter((d) => d.id !== id);
  for (const r of db.requests) {
    if (r.doctorId === id) {
      r.doctorId = null;
      if (r.status === "assigned") r.status = "new";
    }
  }
  saveDb();
  res.json({ ok: true });
});

app.use("/api/admin", admin);

/* ----- Pages ----- */
app.use("/admin", adminAuth, express.static(path.join(__dirname, "admin")));
app.use(express.static(path.join(__dirname, "public")));

app.use((req, res) => res.status(404).send("Page not found"));

app.listen(PORT, () => {
  console.log(`Irfan Home Care Service running at http://localhost:${PORT}`);
  console.log(`Coordinator dashboard: http://localhost:${PORT}/admin/`);
});
