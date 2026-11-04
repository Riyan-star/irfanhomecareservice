const form = document.getElementById("request-form");
const statusEl = document.getElementById("status");
const submitBtn = document.getElementById("submit");

function setStatus(message, kind) {
  statusEl.textContent = message;
  statusEl.className = "status" + (kind ? " " + kind : "");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("", "");

  const data = new FormData(form);
  const payload = {
    name: data.get("name"),
    phone: data.get("phone"),
    area: data.get("area"),
    who: data.get("who"),
    need: data.get("need"),
    details: data.get("details"),
    website: data.get("website"),
    consent: document.getElementById("consent").checked,
  };

  submitBtn.disabled = true;
  submitBtn.textContent = "Sending...";

  try {
    const res = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      setStatus(body.error || "Something went wrong. Please call 0728790921.", "error");
      return;
    }

    form.reset();
    setStatus(
      "Request received. Our coordinator will review it and call you. If it is urgent, call 0728790921.",
      "ok"
    );
  } catch {
    setStatus("We could not send your request. Please call 0728790921.", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Send request";
  }
});

document.getElementById("year").textContent = new Date().getFullYear();
