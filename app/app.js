(function () {
  "use strict";

  var API_BASE = "/api";

  var currentIndex = 0;
  var answers = {};
  var intake = { clientName: "", assessorName: "", industry: "" };

  var maxPossible = QUESTIONS.reduce(function (s, q) { return s + q.weight * 2; }, 0);

  var intakeStep = document.getElementById("intake-step");
  var questionsWrap = document.getElementById("questions-wrap");
  var resultStep = document.getElementById("result-step");
  var gaugeWrap = document.getElementById("gaugeSvgWrap");
  var gaugeValueEl = document.getElementById("gaugeValue");
  var gaugeHintEl = document.getElementById("gaugeHint");

  document.querySelectorAll(".tab-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".tab-btn").forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      var view = btn.dataset.view;
      document.querySelectorAll(".view").forEach(function (v) { v.classList.remove("active"); });
      document.getElementById("view-" + view).classList.add("active");
      if (view === "history") loadHistory();
    });
  });

  function renderGauge(signal) {
    var angle = (signal / 100) * 90;
    var rad = (angle - 90) * (Math.PI / 180);
    var cx = 140, cy = 140, r = 110;
    var needleX = cx + r * Math.cos(rad);
    var needleY = cy + r * Math.sin(rad);

    var ticks = [-90, -45, 0, 45, 90].map(function (a) {
      var rr = (a - 90) * Math.PI / 180;
      var x1 = cx + 96 * Math.cos(rr), y1 = cy + 96 * Math.sin(rr);
      var x2 = cx + 112 * Math.cos(rr), y2 = cy + 112 * Math.sin(rr);
      return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="#3a4553" stroke-width="2"/>';
    }).join("");

    var svg = '<svg viewBox="0 0 280 165" xmlns="http://www.w3.org/2000/svg">' +
      '<defs><linearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="0%">' +
      '<stop offset="0%" stop-color="#4fd1e0"/><stop offset="50%" stop-color="#566270"/><stop offset="100%" stop-color="#e8a94f"/>' +
      '</linearGradient></defs>' +
      '<path d="M 30 140 A 110 110 0 0 1 250 140" fill="none" stroke="url(#arcGrad)" stroke-width="10" stroke-linecap="round" opacity="0.85"/>' +
      ticks +
      '<line x1="' + cx + '" y1="' + cy + '" x2="' + needleX + '" y2="' + needleY + '" stroke="#e8edf2" stroke-width="3" stroke-linecap="round"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="7" fill="#e8edf2"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="3" fill="#10151b"/>' +
      '</svg>';
    gaugeWrap.innerHTML = svg;
    gaugeValueEl.textContent = (signal > 0 ? "+" : "") + Math.round(signal);
    gaugeValueEl.style.color = signal > 15 ? "var(--local)" : signal < -15 ? "var(--cloud)" : "var(--text)";
  }

  function computeSignal() {
    var sum = 0;
    Object.keys(answers).forEach(function (k) {
      var a = answers[k];
      sum += a.lean * a.weight;
    });
    return (sum / maxPossible) * 100;
  }

  function updateLiveGauge() {
    var signal = computeSignal();
    renderGauge(signal);
    var answered = Object.keys(answers).length;
    if (answered === 0) {
      gaugeHintEl.textContent = "Answer questions to see the signal shift.";
    } else {
      gaugeHintEl.textContent = answered + " of " + QUESTIONS.length + " answered -- signal updates live.";
    }
  }

  function renderQuestion(index) {
    var q = QUESTIONS[index];
    var existing = answers[q.id];

    var optionsHtml = q.options.map(function (opt, i) {
      var sel = existing && existing.optIndex === i ? "selected" : "";
      return '<div class="q-option ' + sel + '" data-opt="' + i + '">' +
        '<span class="q-option-marker"></span>' +
        '<span class="q-option-text">' + opt.label + '</span>' +
        '</div>';
    }).join("");

    questionsWrap.innerHTML =
      '<div class="step active q-card">' +
        '<p class="q-progress">QUESTION ' + (index + 1) + ' / ' + QUESTIONS.length + '</p>' +
        '<h2 class="q-title">' + q.title + '</h2>' +
        '<p class="q-help">' + q.help + '</p>' +
        '<div class="q-options">' + optionsHtml + '</div>' +
        '<div class="q-nav">' +
          '<button class="btn-secondary" id="backBtn"' + (index === 0 ? " disabled" : "") + '>&larr; Back</button>' +
          '<button class="btn-primary" id="nextBtn"' + (existing ? "" : " disabled") + '>' + (index === QUESTIONS.length - 1 ? "See result \u2192" : "Next \u2192") + '</button>' +
        '</div>' +
      '</div>';

    questionsWrap.querySelectorAll(".q-option").forEach(function (el) {
      el.addEventListener("click", function () {
        var optIndex = parseInt(el.dataset.opt, 10);
        var opt = q.options[optIndex];
        answers[q.id] = { lean: opt.lean, weight: q.weight, label: opt.label, title: q.title, optIndex: optIndex };
        questionsWrap.querySelectorAll(".q-option").forEach(function (o) { o.classList.remove("selected"); });
        el.classList.add("selected");
        document.getElementById("nextBtn").disabled = false;
        updateLiveGauge();
      });
    });

    document.getElementById("backBtn").addEventListener("click", function () {
      currentIndex = Math.max(0, index - 1);
      renderQuestion(currentIndex);
    });

    document.getElementById("nextBtn").addEventListener("click", function () {
      if (index === QUESTIONS.length - 1) {
        showResult();
      } else {
        currentIndex = index + 1;
        renderQuestion(currentIndex);
      }
    });

    updateLiveGauge();
  }

  function getVerdict(signal) {
    if (signal >= 50) return { key: "strong-local", title: "Strong fit for Azure Local", cls: "v-strong-local",
      summary: "Connectivity, latency, and sovereignty needs point clearly toward on-premises Azure. This is a textbook Azure Local scenario -- worth a formal hardware sizing conversation." };
    if (signal >= 20) return { key: "good-local", title: "Good fit for Azure Local", cls: "v-good-local",
      summary: "Several strong signals favor Azure Local, though not every box is checked. Worth proposing, ideally alongside a discussion of the weaker factors below." };
    if (signal >= -19) return { key: "hybrid", title: "Hybrid -- needs a deeper look", cls: "v-hybrid",
      summary: "Signals are mixed. This client may be better served by a hybrid approach, or the picture may sharpen once you dig into the weaker-scoring factors." };
    if (signal >= -49) return { key: "good-cloud", title: "Public Azure is likely the better fit", cls: "v-good-cloud",
      summary: "Most factors lean toward public cloud -- likely better elasticity, lower operational burden, and no case for hardware ownership. Azure Local isn't ruled out, but it's not the natural starting point." };
    return { key: "strong-cloud", title: "Not recommended -- stick with public Azure", cls: "v-strong-cloud",
      summary: "Nothing here points to on-premises constraints. Public Azure gives this client everything they need without the operational overhead of owning hardware." };
  }

  function showResult() {
    intakeStep.classList.remove("active");
    questionsWrap.querySelectorAll(".step").forEach(function (s) { s.classList.remove("active"); });
    resultStep.classList.add("active");

    var signal = computeSignal();
    var verdict = getVerdict(signal);
    renderGauge(signal);
    gaugeHintEl.textContent = "Assessment complete.";

    document.getElementById("verdictTitle").textContent = verdict.title;
    document.getElementById("verdictSummary").textContent = verdict.summary;

    var breakdownList = document.getElementById("breakdownList");
    breakdownList.innerHTML = QUESTIONS.map(function (q) {
      var a = answers[q.id];
      var pct = Math.abs(a.lean) / 2 * 45;
      var side = a.lean >= 0 ? "local" : "cloud";
      return '<div class="breakdown-row">' +
        '<span class="breakdown-q">' + q.title + '</span>' +
        '<div class="breakdown-bar-track">' +
          '<div class="breakdown-bar-mid"></div>' +
          '<div class="breakdown-bar-fill ' + side + '" style="width:' + pct + '%"></div>' +
        '</div>' +
      '</div>';
    }).join("");

    document.getElementById("saveStatus").textContent = "";
    document.getElementById("saveBtn").disabled = false;
  }

  document.getElementById("startBtn").addEventListener("click", function () {
    intake.clientName = document.getElementById("clientName").value.trim();
    intake.assessorName = document.getElementById("assessorName").value.trim();
    intake.industry = document.getElementById("industry").value.trim();

    if (!intake.clientName) {
      document.getElementById("clientName").focus();
      document.getElementById("clientName").style.borderColor = "var(--danger)";
      return;
    }

    intakeStep.classList.remove("active");
    currentIndex = 0;
    answers = {};
    renderQuestion(0);
  });

  document.getElementById("restartBtn").addEventListener("click", resetAll);

  function resetAll() {
    answers = {};
    currentIndex = 0;
    document.getElementById("clientName").value = "";
    document.getElementById("assessorName").value = "";
    document.getElementById("industry").value = "";
    document.getElementById("clientName").style.borderColor = "";
    questionsWrap.innerHTML = "";
    resultStep.classList.remove("active");
    intakeStep.classList.add("active");
    renderGauge(0);
    gaugeHintEl.textContent = "Answer questions to see the signal shift.";
  }

  document.getElementById("saveBtn").addEventListener("click", function () {
    var saveBtn = document.getElementById("saveBtn");
    var status = document.getElementById("saveStatus");
    var signal = computeSignal();
    var verdict = getVerdict(signal);

    var answersOut = {};
    Object.keys(answers).forEach(function (k) {
      answersOut[k] = { label: answers[k].label, lean: answers[k].lean };
    });

    var payload = {
      clientName: intake.clientName,
      assessorName: intake.assessorName || "Unknown",
      industry: intake.industry || "",
      signal: Math.round(signal),
      verdictKey: verdict.key,
      verdictTitle: verdict.title,
      answers: answersOut,
      createdAt: new Date().toISOString()
    };

    saveBtn.disabled = true;
    status.textContent = "Saving...";

    fetch(API_BASE + "/assessments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (res) {
      if (!res.ok) throw new Error("Save failed: " + res.status);
      status.textContent = "Saved to history.";
    }).catch(function (err) {
      console.error(err);
      status.textContent = "Couldn't save -- check that the API is deployed and connected (see README).";
      saveBtn.disabled = false;
    });
  });

  function loadHistory() {
    var list = document.getElementById("historyList");
    list.innerHTML = '<p class="empty-state">Loading...</p>';

    fetch(API_BASE + "/assessments").then(function (res) {
      if (!res.ok) throw new Error("Fetch failed: " + res.status);
      return res.json();
    }).then(function (items) {
      if (!items.length) {
        list.innerHTML = '<p class="empty-state">No assessments saved yet. Run one from the "New Assessment" tab.</p>';
        return;
      }
      items.sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
      list.innerHTML = items.map(function (item) {
        var verdict = getVerdict(item.signal);
        var date = new Date(item.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
        return '<div class="history-row">' +
          '<div>' +
            '<div class="history-client">' + escapeHtml(item.clientName) + '</div>' +
            '<div class="history-meta">' + escapeHtml(item.industry || "\u2014") + ' \u00b7 assessed by ' + escapeHtml(item.assessorName) + ' \u00b7 ' + date + '</div>' +
          '</div>' +
          '<div class="history-verdict ' + verdict.cls + '">' + verdict.title + '</div>' +
          '<div class="history-score">' + (item.signal > 0 ? "+" : "") + item.signal + '</div>' +
        '</div>';
      }).join("");
    }).catch(function (err) {
      console.error(err);
      list.innerHTML = '<p class="empty-state">Couldn\'t load history -- check that the API is deployed and connected (see README).</p>';
    });
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  renderGauge(0);
})();
