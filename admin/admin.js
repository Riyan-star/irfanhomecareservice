const state = { requests: [], doctors: [], filter: "new" };

const listEl = document.getElementById("list");
const tabsEl = document.getElementById("tabs");
const doctorsEl = document.getElementById("doctors");
const errorEl = document.getElementById("error");

const TABS = [
  ["new", "New"],
  ["assigned", "Assigned"],
  ["done", "Done"],
  ["cancelled", "Cancelled"],
];

/* Build elements safely (text only, never HTML from users). */
function h(tag, props = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value);
  }
  for (const kid of kids.flat()) {
    if (kid == null) continue;
    node.append(kid.nodeType ? kid : document.createTextNode(kid));
  }
  return node;
}

async function api(path, options = {}) {
  const res = await fetch("/api/admin" + path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "Error " + res.status);
  return body;
}

function showError(message) {
  errorEl.textContent = message || "";
}

async function load() {
  try {
    const data = await api("/requests");
    state.requests = data.requests;
    state.doctors = data.doctors;
    showError("");
    render();
  } catch (err) {
    showError(err.message);
  }
}

async function update(id, changes) {
  try {
    await api("/requests/" + id, { method: "PATCH", body: JSON.stringify(changes) });
    await load();
  } catch (err) {
    showError(err.message);
  }
}

function doctorName(id) {
  const d = state.doctors.find((x) => x.id === id);
  return d ? d.name : "Unknown doctor";
}

function renderTabs() {
  tabsEl.replaceChildren(
    ...TABS.map(([key, label]) => {
      const count = state.requests.filter((r) => r.status === key).length;
      return h("button", {
        type: "button",
        role: "tab",
        class: "tab",
        "aria-selected": String(state.filter === key),
        text: `${label} (${count})`,
        onclick: () => { state.filter = key; render(); },
      });
    })
  );
}

function renderCard(r) {
  const select = h(
    "select",
    { "aria-label": "Choose a doctor for " + r.name },
    h("option", { value: "", text: "Choose a doctor" }),
    ...state.doctors.map((d) =>
      h("option", {
        value: String(d.id),
        text: d.name + (d.available ? "" : " (on a visit)"),
        ...(r.doctorId === d.id ? { selected: "selected" } : {}),
      })
    )
  );
  const visit = h("input", {
    type: "text",
    maxlength: "60",
    placeholder: "Visit time, e.g. Thu 10:00",
    "aria-label": "Visit time for " + r.name,
    value: r.visit || "",
  });

  const actions = h("div", { class: "actions" });
  if (r.status === "new" || r.status === "assigned") {
    actions.append(
      select,
      visit,
      h("button", {
        type: "button",
        class: "btn",
        text: r.status === "assigned" ? "Update" : "Assign",
        onclick: () => {
          if (!select.value) return showError("Choose a doctor first.");
          update(r.id, { doctorId: select.value, visit: visit.value });
        },
      })
    );
  }
  if (r.status === "assigned") {
    actions.append(h("button", { type: "button", class: "btn ghost", text: "Mark done", onclick: () => update(r.id, { status: "done" }) }));
  }
  if (r.status === "new" || r.status === "assigned") {
    actions.append(h("button", { type: "button", class: "btn danger", text: "Cancel", onclick: () => update(r.id, { status: "cancelled" }) }));
  }
  if (r.status === "done" || r.status === "cancelled") {
    actions.append(h("button", { type: "button", class: "btn ghost", text: "Reopen", onclick: () => update(r.id, { status: r.doctorId ? "assigned" : "new" }) }));
  }

  return h(
    "article",
    { class: "card" },
    h("div", { class: "who" }, r.name, " · ", h("a", { href: "tel:" + r.phone.replace(/[^0-9+]/g, ""), text: r.phone })),
    h("div", { class: "meta", text: `${r.area} · ${r.who} · ${r.need}` }),
    r.details ? h("div", { class: "details", text: r.details }) : null,
    h("div", { class: "meta", text: new Date(r.createdAt).toLocaleString() }),
    r.doctorId ? h("div", {}, h("span", { class: "badge", text: `${doctorName(r.doctorId)}${r.visit ? " · " + r.visit : ""}` })) : null,
    actions
  );
}

function renderList() {
  const items = state.requests.filter((r) => r.status === state.filter);
  if (!items.length) {
    listEl.replaceChildren(h("div", { class: "empty", text: "No requests here." }));
    return;
  }
  listEl.replaceChildren(...items.map(renderCard));
}

function renderDoctors() {
  doctorsEl.replaceChildren(
    ...state.doctors.map((d) =>
      h(
        "div",
        { class: "doc-row" },
        h("span", { class: "dot " + (d.available ? "on" : "off") }),
        h("span", { class: "name", text: d.name }),
        h("button", {
          type: "button",
          class: "btn ghost small",
          text: d.available ? "Available" : "On a visit",
          "aria-label": `${d.name}: ${d.available ? "available" : "on a visit"}. Change`,
          onclick: async () => {
            try {
              await api("/doctors/" + d.id, { method: "PATCH", body: JSON.stringify({ available: !d.available }) });
              await load();
            } catch (err) { showError(err.message); }
          },
        }),
        h("button", {
          type: "button",
          class: "btn danger small",
          text: "Remove",
          "aria-label": "Remove " + d.name,
          onclick: async () => {
            if (!confirm(`Remove ${d.name}? Their assigned requests go back to New.`)) return;
            try {
              await api("/doctors/" + d.id, { method: "DELETE" });
              await load();
            } catch (err) { showError(err.message); }
          },
        })
      )
    )
  );
}

function render() {
  renderTabs();
  renderList();
  renderDoctors();
}

document.getElementById("refresh").addEventListener("click", load);

document.getElementById("doctor-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = document.getElementById("d-name");
  const phone = document.getElementById("d-phone");
  try {
    await api("/doctors", { method: "POST", body: JSON.stringify({ name: name.value, phone: phone.value }) });
    name.value = "";
    phone.value = "";
    await load();
  } catch (err) {
    showError(err.message);
  }
});

load();
setInterval(load, 30000);
