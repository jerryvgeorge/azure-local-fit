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

  function getContributions() {
    return QUESTIONS.map(function (q) {
      var a = answers[q.id];
      return {
        id: q.id,
        title: q.title,
        category: q.category,
        label: a.label,
        lean: a.lean,
        weight: q.weight,
        contribution: a.lean * q.weight
      };
    });
  }

  function computeCategoryBreakdown() {
    var contributions = getContributions();
    var byCategory = {};
    contributions.forEach(function (c) {
      if (!byCategory[c.category]) byCategory[c.category] = { sumContribution: 0, sumWeight: 0 };
      byCategory[c.category].sumContribution += c.contribution;
      byCategory[c.category].sumWeight += c.weight;
    });
    return Object.keys(CATEGORIES).map(function (key) {
      var b = byCategory[key];
      if (!b) return null;
      var avgLean = b.sumContribution / b.sumWeight; // -2..2
      return { key: key, name: CATEGORIES[key], avgLean: avgLean };
    }).filter(Boolean);
  }

  function computeConfidence() {
    var contributions = getContributions();
    var extremeCount = contributions.filter(function (c) { return Math.abs(c.lean) === 2; }).length;
    var ratio = extremeCount / contributions.length;
    if (ratio >= 0.6) {
      return "High confidence -- most answers point clearly in one direction, so this verdict rests on strong signals rather than close calls.";
    }
    if (ratio >= 0.3) {
      return "Moderate confidence -- a solid mix of decisive answers, with a few close calls that could shift the picture.";
    }
    return "Low confidence -- many answers were middle-of-the-road. Worth a follow-up conversation on the specific factors below before finalizing a recommendation.";
  }

  function getSupportingAndWeakest(signal) {
    var contributions = getContributions();
    var sorted = contributions.slice().sort(function (a, b) { return b.contribution - a.contribution; });
    var direction = signal >= 0 ? "local" : "cloud";
    var supporting, weakest;
    if (direction === "local") {
      supporting = sorted.slice(0, 3);
      weakest = sorted.slice(-3).reverse();
    } else {
      supporting = sorted.slice(-3).reverse();
      weakest = sorted.slice(0, 3);
    }
    return { supporting: supporting, weakest: weakest };
  }

  function buildRecommendations(verdict, categoryBreakdown) {
    var weakestCategory = categoryBreakdown.slice().sort(function (a, b) {
      return Math.abs(b.avgLean) - Math.abs(a.avgLean);
    }).pop(); // smallest |avgLean| = least decisive category

    var base = {
      "strong-local": [
        "Move forward with a formal Azure Local sizing and hardware proposal.",
        "Confirm hardware compatibility list (HCL) requirements with the client's procurement team."
      ],
      "good-local": [
        "Propose Azure Local, but address the weaker factors below before finalizing scope.",
        "Consider a scoping call focused specifically on " + (weakestCategory ? weakestCategory.name.toLowerCase() : "the least decisive area") + "."
      ],
      "hybrid": [
        "Schedule a follow-up discovery call focused on " + (weakestCategory ? weakestCategory.name.toLowerCase() : "the mixed factors") + " to sharpen the picture.",
        "Consider proposing a small pilot or proof-of-concept rather than a full commitment either way."
      ],
      "good-cloud": [
        "Recommend a public Azure landing zone as the primary path.",
        "Revisit Azure Local only if " + (weakestCategory ? weakestCategory.name.toLowerCase() : "circumstances") + " change materially."
      ],
      "strong-cloud": [
        "Proceed with a public Azure architecture.",
        "No further Azure Local discovery needed unless circumstances change significantly."
      ]
    };
    return base[verdict.key] || [];
  }

  function renderDetailedReport(signal, verdict) {
    var categoryBreakdown = computeCategoryBreakdown();
    var confidenceText = computeConfidence();
    var supportWeak = getSupportingAndWeakest(signal);
    var recommendations = buildRecommendations(verdict, categoryBreakdown);

    document.getElementById("confidenceText").textContent = confidenceText;

    document.getElementById("categoryList").innerHTML = categoryBreakdown.map(function (c) {
      var pct = Math.abs(c.avgLean) / 2 * 45;
      var side = c.avgLean >= 0 ? "local" : "cloud";
      var scoreLabel = (c.avgLean > 0.15 ? "leans Local" : c.avgLean < -0.15 ? "leans Cloud" : "neutral");
      return '<div class="category-row">' +
        '<div class="category-row-top">' +
          '<span class="category-name">' + c.name + '</span>' +
          '<span class="category-score">' + (c.avgLean > 0 ? "+" : "") + c.avgLean.toFixed(1) + ' \u00b7 ' + scoreLabel + '</span>' +
        '</div>' +
        '<div class="category-bar-track">' +
          '<div class="category-bar-mid"></div>' +
          '<div class="category-bar-fill ' + side + '" style="width:' + pct + '%"></div>' +
        '</div>' +
      '</div>';
    }).join("");

    function factorLine(c) {
      return c.title + ' \u2014 "' + c.label + '" (weight \u00d7' + c.weight + ')';
    }

    document.getElementById("supportingList").innerHTML = supportWeak.supporting.map(function (c) {
      return "<li>" + factorLine(c) + "</li>";
    }).join("") || '<li class="empty-note">None stand out.</li>';

    document.getElementById("weakestList").innerHTML = supportWeak.weakest.map(function (c) {
      return "<li>" + factorLine(c) + "</li>";
    }).join("") || '<li class="empty-note">None stand out.</li>';

    document.getElementById("recommendationsList").innerHTML = recommendations.map(function (r) {
      return "<li>" + r + "</li>";
    }).join("");
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

    renderDetailedReport(signal, verdict);
    var reportEl = document.getElementById("detailedReport");
    reportEl.classList.remove("open");
    document.getElementById("toggleReportBtn").textContent = "Show detailed report \u2193";

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

  document.getElementById("toggleReportBtn").addEventListener("click", function () {
    var reportEl = document.getElementById("detailedReport");
    var btn = document.getElementById("toggleReportBtn");
    var isOpen = reportEl.classList.toggle("open");
    btn.textContent = isOpen ? "Hide detailed report \u2191" : "Show detailed report \u2193";
  });

  document.getElementById("exportPdfBtn").addEventListener("click", function () {
    exportResultAsPdf();
  });

  function exportResultAsPdf() {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert("PDF library failed to load -- check your internet connection and try again.");
      return;
    }

    var signal = computeSignal();
    var verdict = getVerdict(signal);
    var categoryBreakdown = computeCategoryBreakdown();
    var confidenceText = computeConfidence();
    var supportWeak = getSupportingAndWeakest(signal);
    var recommendations = buildRecommendations(verdict, categoryBreakdown);

    var doc = new window.jspdf.jsPDF({ unit: "pt", format: "a4" });
    var pageWidth = doc.internal.pageSize.getWidth();
    var pageHeight = doc.internal.pageSize.getHeight();
    var margin = 48;
    var contentWidth = pageWidth - margin * 2;
    var y = margin;

    function checkPageBreak(neededSpace) {
      if (y + neededSpace > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
    }

    function heading(text) {
      checkPageBreak(28);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(20, 24, 30);
      doc.text(text, margin, y);
      y += 18;
    }

    function paragraph(text, opts) {
      opts = opts || {};
      doc.setFont("helvetica", opts.bold ? "bold" : "normal");
      doc.setFontSize(opts.size || 10.5);
      doc.setTextColor.apply(doc, opts.color || [70, 80, 90]);
      var lines = doc.splitTextToSize(text, contentWidth);
      checkPageBreak(lines.length * 14 + 4);
      doc.text(lines, margin, y);
      y += lines.length * 14 + (opts.spacingAfter || 8);
    }

    function bulletList(items) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      doc.setTextColor(70, 80, 90);
      items.forEach(function (item) {
        var lines = doc.splitTextToSize("\u2022  " + item, contentWidth - 10);
        checkPageBreak(lines.length * 14 + 2);
        doc.text(lines, margin, y);
        y += lines.length * 14 + 4;
      });
      y += 6;
    }

    function divider() {
      checkPageBreak(14);
      doc.setDrawColor(220, 224, 228);
      doc.line(margin, y, pageWidth - margin, y);
      y += 16;
    }

    // Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(20, 24, 30);
    doc.text("Azure Local Fit Assessment", margin, y);
    y += 26;

    doc.setFont("courier", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(120, 130, 140);
    var metaLine = "Client: " + (intake.clientName || "\u2014") +
      "   \u00b7   Assessed by: " + (intake.assessorName || "\u2014") +
      (intake.industry ? "   \u00b7   Industry: " + intake.industry : "") +
      "   \u00b7   " + new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    doc.text(metaLine, margin, y);
    y += 24;

    divider();

    // Verdict + score
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    var verdictColor = signal > 15 ? [180, 130, 40] : signal < -15 ? [30, 130, 145] : [90, 100, 110];
    doc.setTextColor.apply(doc, verdictColor);
    doc.text(verdict.title, margin, y);
    doc.setFont("courier", "bold");
    doc.setFontSize(15);
    doc.text((signal > 0 ? "+" : "") + Math.round(signal) + " signal", pageWidth - margin, y, { align: "right" });
    y += 22;

    paragraph(verdict.summary, { spacingAfter: 14 });

    // Signal breakdown
    heading("Signal Breakdown");
    QUESTIONS.forEach(function (q) {
      var a = answers[q.id];
      paragraph(q.title, { bold: true, size: 10, color: [40, 46, 54], spacingAfter: 2 });
      paragraph('"' + a.label + '"   (lean ' + (a.lean > 0 ? "+" : "") + a.lean + ", weight \u00d7" + q.weight + ")", { size: 9.5, color: [130, 138, 148], spacingAfter: 10 });
    });

    divider();

    // Category scores
    heading("Category Scores");
    var categoryLines = categoryBreakdown.map(function (c) {
      var label = c.avgLean > 0.15 ? "leans Local" : c.avgLean < -0.15 ? "leans Cloud" : "neutral";
      return c.name + ": " + (c.avgLean > 0 ? "+" : "") + c.avgLean.toFixed(1) + " (" + label + ")";
    });
    bulletList(categoryLines);

    // Confidence
    heading("Confidence");
    paragraph(confidenceText, { spacingAfter: 14 });

    // Supporting / weakest
    heading("Supporting Factors");
    bulletList(supportWeak.supporting.map(function (c) {
      return c.title + ' -- "' + c.label + '"';
    }));

    heading("Weakest Factors");
    bulletList(supportWeak.weakest.map(function (c) {
      return c.title + ' -- "' + c.label + '"';
    }));

    // Recommendations
    heading("Recommended Next Steps");
    bulletList(recommendations);

    divider();
    doc.setFont("courier", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(160, 168, 176);
    doc.text("Generated by Signal -- Azure Local Fit Assessment tool -- " + new Date().toLocaleString(), margin, pageHeight - 24);

    var safeClientName = (intake.clientName || "assessment").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    doc.save("azure-local-fit-" + safeClientName + ".pdf");
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
