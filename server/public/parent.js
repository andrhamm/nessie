// @ts-nocheck
(() => {
  // --- Tab switching ---
  const tabs = document.querySelectorAll(".tab-btn");
  const panels = {
    nessie: document.getElementById("nessie-tab"),
    parent: document.getElementById("parent-tab"),
  };
  // Nessie-only header controls (status badge + TTS selector) hide when
  // the Parent tab is open so stale "Error" states don't leak across.
  const nessieOnlyControls = [
    document.getElementById("status-badge"),
    document.getElementById("tts-select"),
    document.querySelector(".tts-select-label"),
  ];

  const TAB_STORAGE_KEY = "nessie.activeTab";
  const ALLOWED_TABS = ["nessie", "parent"];

  const activate = (name) => {
    for (const tab of tabs) {
      const active = tab.dataset.tab === name;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    }
    for (const [key, panel] of Object.entries(panels)) {
      if (!panel) continue;
      const active = key === name;
      panel.classList.toggle("active", active);
      panel.hidden = !active;
    }
    for (const el of nessieOnlyControls) {
      if (el) el.hidden = name !== "nessie";
    }
    try {
      localStorage.setItem(TAB_STORAGE_KEY, name);
    } catch {
      // storage unavailable (private mode, quota) — skip persistence
    }
    if (name === "parent") refreshState();
    // Clear any stale status-badge state (e.g. "Error" from a previous mic
    // denial) when we come back to the Nessie tab.
    if (name === "nessie") {
      const badge = document.getElementById("status-badge");
      if (badge) {
        badge.textContent = "Ready";
        badge.className = "status-badge";
      }
    }
  };

  for (const tab of tabs) {
    tab.addEventListener("click", () => activate(tab.dataset.tab));
  }

  // --- Sidebar rendering ---
  const routineEl = document.getElementById("sidebar-routine");
  const constraintsEl = document.getElementById("sidebar-constraints");
  const profilesEl = document.getElementById("sidebar-profiles");
  const personsEl = document.getElementById("sidebar-persons");
  const eventsEl = document.getElementById("sidebar-events");

  const escapeHtml = (text) => {
    const el = document.createElement("span");
    el.textContent = text ?? "";
    return el.innerHTML;
  };

  const locationEl = document.getElementById("sidebar-location");
  const timezoneEl = document.getElementById("sidebar-timezone");
  const voiceEl = document.getElementById("sidebar-voice");
  const providerEl = document.getElementById("sidebar-provider");

  const showSidebarError = (message) => {
    routineEl.textContent = "—";
    constraintsEl.textContent = "—";
    profilesEl.innerHTML = "";
    personsEl.innerHTML = `<li class="muted" style="color:#c0392b">${escapeHtml(message)}</li>`;
    eventsEl.innerHTML = "";
    if (locationEl) locationEl.textContent = "—";
    if (timezoneEl) timezoneEl.textContent = "—";
    if (voiceEl) voiceEl.textContent = "—";
    if (providerEl) providerEl.textContent = "—";
  };

  const renderRuntimeConfig = (cfg) => {
    const c = cfg ?? {};
    if (locationEl) {
      if (c.location?.label) {
        const coords =
          typeof c.location.lat === "number" && typeof c.location.lon === "number"
            ? ` (${c.location.lat.toFixed(3)}, ${c.location.lon.toFixed(3)})`
            : "";
        locationEl.textContent = c.location.label + coords;
        locationEl.classList.remove("muted");
      } else {
        locationEl.textContent = "—";
        locationEl.classList.add("muted");
      }
    }
    if (timezoneEl) {
      timezoneEl.textContent = c.timezone || "—";
      timezoneEl.classList.toggle("muted", !c.timezone);
    }
    if (voiceEl) {
      voiceEl.textContent = c.default_voice || "—";
      voiceEl.classList.toggle("muted", !c.default_voice);
    }
    if (providerEl) {
      providerEl.textContent = c.default_provider || "—";
      providerEl.classList.toggle("muted", !c.default_provider);
    }
  };

  async function refreshState() {
    try {
      const res = await fetch("/v1/parent_state");
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        console.error("parent_state HTTP error", res.status, detail);
        showSidebarError(`Failed to load state: HTTP ${res.status}`);
        return;
      }
      const state = await res.json();
      renderRuntimeConfig(state.runtime_config);
      routineEl.textContent = state.routine || "—";
      constraintsEl.textContent = state.constraints || "—";
      profilesEl.innerHTML = (state.profiles ?? [])
        .map(
          (p) =>
            `<li><strong>${escapeHtml(p.name)}</strong> (${p.age ?? "?"}) — ${escapeHtml(p.notes ?? "")}</li>`,
        )
        .join("");
      personsEl.innerHTML = (state.persons ?? [])
        .map(
          (p) =>
            `<li><button type="button" class="person-link" data-slug="${escapeHtml(p.slug)}">${escapeHtml(p.name)}</button> <span class="muted">(${escapeHtml(p.relation ?? "")})</span></li>`,
        )
        .join("");
      for (const btn of personsEl.querySelectorAll(".person-link")) {
        btn.addEventListener("click", () => showPersonDetail(btn.dataset.slug));
      }
      const events = state.upcoming_events ?? [];
      eventsEl.innerHTML = events.length
        ? events
            .map(
              (e) =>
                `<li><span class="muted">${escapeHtml(e.date)}</span> — ${escapeHtml(e.title)}</li>`,
            )
            .join("")
        : `<li class="muted">No upcoming events</li>`;
    } catch (err) {
      console.error("parent_state fetch failed:", err);
      showSidebarError(`Fetch failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Restore the last-active tab on page load. Must run AFTER refreshState
  // is declared because `activate("parent")` calls it directly.
  let savedTab = null;
  try {
    savedTab = localStorage.getItem(TAB_STORAGE_KEY);
  } catch {
    savedTab = null;
  }
  if (savedTab && ALLOWED_TABS.includes(savedTab)) {
    activate(savedTab);
  }

  // --- Person detail drawer ---
  const detailEl = document.getElementById("person-detail");
  const detailNameEl = document.getElementById("person-detail-name");
  const detailBodyEl = document.getElementById("person-detail-body");
  const detailCloseBtn = document.getElementById("person-detail-close");

  const EDGE_LABELS = {
    parent_of: "parent of",
    sibling_of: "sibling of",
    spouse_of: "spouse of",
    friend_of: "friend of",
    classmate_of: "classmate of",
  };

  const showPersonDetail = async (slug) => {
    if (!slug) return;
    try {
      const res = await fetch(`/v1/parent_person?slug=${encodeURIComponent(slug)}`);
      if (!res.ok) {
        detailNameEl.textContent = slug;
        detailBodyEl.innerHTML = `<p class="muted">Not found.</p>`;
        detailEl.hidden = false;
        return;
      }
      const person = await res.json();
      detailNameEl.textContent = person.name;
      const aliases =
        Array.isArray(person.aliases) && person.aliases.length
          ? `<p class="muted">also: ${person.aliases.map(escapeHtml).join(", ")}</p>`
          : "";
      const relation = person.relation
        ? `<p><strong>${escapeHtml(person.relation)}</strong> of the household</p>`
        : "";
      const notes = person.notes ? `<p class="person-notes">${escapeHtml(person.notes)}</p>` : "";

      const outgoing = (person.relations?.outgoing ?? []).map(
        (r) =>
          `<li>${escapeHtml(EDGE_LABELS[r.edge] ?? r.edge)} <button type="button" class="person-link" data-slug="${escapeHtml(r.to)}">${escapeHtml(r.name ?? r.to)}</button></li>`,
      );
      const incoming = (person.relations?.incoming ?? []).map(
        (r) =>
          `<li><button type="button" class="person-link" data-slug="${escapeHtml(r.from)}">${escapeHtml(r.name ?? r.from)}</button> is ${escapeHtml(EDGE_LABELS[r.edge] ?? r.edge)} them</li>`,
      );
      const relHtml =
        outgoing.length + incoming.length === 0
          ? `<p class="muted">No recorded relationships yet.</p>`
          : `<ul class="sidebar-list">${[...outgoing, ...incoming].join("")}</ul>`;

      detailBodyEl.innerHTML = `${relation}${aliases}${notes}<h4>Relationships</h4>${relHtml}`;
      detailEl.hidden = false;
      for (const btn of detailBodyEl.querySelectorAll(".person-link")) {
        btn.addEventListener("click", () => showPersonDetail(btn.dataset.slug));
      }
    } catch (err) {
      console.error("person detail fetch failed:", err);
    }
  };

  detailCloseBtn?.addEventListener("click", () => {
    detailEl.hidden = true;
  });

  // --- Ness chat ---
  const chatEl = document.getElementById("ness-chat");
  const formEl = document.getElementById("ness-form");
  const inputEl = document.getElementById("ness-input");

  const appendTurn = (who, text) => {
    const div = document.createElement("div");
    div.className = `ness-msg ness-msg-${who}`;
    div.innerHTML = `<div class="ness-bubble"><p>${escapeHtml(text)}</p></div>`;
    chatEl.appendChild(div);
    chatEl.scrollTop = chatEl.scrollHeight;
    return div.querySelector("p");
  };

  formEl.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = inputEl.value.trim();
    if (!message) return;
    inputEl.value = "";
    appendTurn("user", message);
    const responseEl = appendTurn("ness", "…");
    responseEl.textContent = "";

    try {
      const res = await fetch("/v1/parent_chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, session_id: "parent" }),
      });
      if (!res.ok || !res.body) {
        responseEl.textContent = `Error: ${res.status}`;
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      streamLoop: while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice("data: ".length);
          try {
            const chunk = JSON.parse(payload);
            if (chunk.type === "text") responseEl.textContent += chunk.delta;
            if (chunk.type === "error") responseEl.textContent += ` [error: ${chunk.message}]`;
            if (chunk.type === "done" || chunk.type === "error") {
              break streamLoop;
            }
          } catch {
            // ignore partial frames
          }
        }
      }
    } catch (err) {
      responseEl.textContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
    } finally {
      // Ness may have mutated the store via tools regardless of how the
      // stream terminated — refresh the sidebar unconditionally so the UI
      // never lags behind.
      refreshState();
    }
  });

  // No idle polling. Sidebar refreshes on tab activation and after each
  // Ness response. If you need to see fresh external edits, switch tabs
  // off and back or hit refresh in the browser.
})();
