(function () {
  "use strict";

  /* ============================================
     State + element refs
     ============================================ */
  var state = {
    type: "text",
    size: 280,
    ec: "M",
    fg: "#0B0E0F",
    bg: "#FFFFFF"
  };

  var holder = document.getElementById("qr-canvas-holder");
  var qrInstance = null;
  var debounceTimer = null;

  var els = {
    tabs: document.querySelectorAll(".tab"),
    panels: document.querySelectorAll(".form-panel"),

    text: document.getElementById("f-text"),

    wSsid: document.getElementById("w-ssid"),
    wSecurity: document.getElementById("w-security"),
    wPass: document.getElementById("w-pass"),
    wPassField: document.getElementById("w-pass-field"),
    wHidden: document.getElementById("w-hidden"),

    vFirst: document.getElementById("v-first"),
    vLast: document.getElementById("v-last"),
    vOrg: document.getElementById("v-org"),
    vPhone: document.getElementById("v-phone"),
    vEmail: document.getElementById("v-email"),
    vUrl: document.getElementById("v-url"),

    size: document.getElementById("opt-size"),
    sizeVal: document.getElementById("opt-size-val"),
    ec: document.getElementById("opt-ec"),
    fg: document.getElementById("opt-fg"),
    fgHex: document.getElementById("opt-fg-hex"),
    bg: document.getElementById("opt-bg"),
    bgHex: document.getElementById("opt-bg-hex"),
    contrastHint: document.getElementById("contrast-hint"),
    emojiHint: document.getElementById("emoji-hint"),

    caption: document.getElementById("preview-caption"),
    btnDownload: document.getElementById("btn-download"),
    btnCopy: document.getElementById("btn-copy"),
    copyFeedback: document.getElementById("copy-feedback")
  };

  /* ============================================
     Payload builders
     ============================================ */

  // Escape characters with special meaning inside Wi-Fi / vCard QR payloads.
  // Spec-relevant special chars: backslash, semicolon, comma, colon (for WIFI), and quotes.
  function escapeWifi(str) {
    return String(str).replace(/([\\;,:"])/g, "\\$1");
  }

  function buildWifiPayload() {
    var ssid = escapeWifi(els.wSsid.value.trim());
    var security = els.wSecurity.value; // WPA | WEP | nopass
    var pass = els.wPass.value;
    var hidden = els.wHidden.checked ? "true" : "false";

    var payload = "WIFI:T:" + security + ";S:" + ssid + ";";
    if (security !== "nopass") {
      payload += "P:" + escapeWifi(pass) + ";";
    }
    payload += "H:" + hidden + ";;";
    return payload;
  }

  // vCard 3.0 line folding isn't required at this length, but escape per spec:
  // backslash, comma, semicolon must be escaped; newlines become \n.
  function escapeVcard(str) {
    return String(str)
      .replace(/\\/g, "\\\\")
      .replace(/\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");
  }

  function buildVcardPayload() {
    var first = escapeVcard(els.vFirst.value.trim());
    var last = escapeVcard(els.vLast.value.trim());
    var org = escapeVcard(els.vOrg.value.trim());
    var phone = els.vPhone.value.trim().replace(/[^\d+\-\s()]/g, "");
    var email = els.vEmail.value.trim();
    var url = els.vUrl.value.trim();

    var lines = ["BEGIN:VCARD", "VERSION:3.0"];
    lines.push("N:" + last + ";" + first + ";;;");
    var displayName = (first + " " + last).trim();
    lines.push("FN:" + (displayName ? escapeVcard(displayName) : "Unnamed Contact"));
    if (org) lines.push("ORG:" + org);
    if (phone) lines.push("TEL;TYPE=CELL:" + phone);
    if (email) lines.push("EMAIL:" + escapeVcard(email));
    if (url) lines.push("URL:" + escapeVcard(url));
    lines.push("END:VCARD");
    return lines.join("\n");
  }

  function buildPayload() {
    var raw;
    if (state.type === "wifi") raw = buildWifiPayload();
    else if (state.type === "vcard") raw = buildVcardPayload();
    else raw = els.text.value;

    return sanitizeForQr(raw);
  }

  // The bundled qrcodejs library's UTF-8 byte-mode encoder reads UTF-16 code
  // units one at a time (via charCodeAt), so it cannot correctly encode any
  // character represented as a surrogate pair — that's most emoji and rarer
  // CJK extension characters. Feeding those in causes it to throw mid-encode.
  // We strip them before they ever reach the library, and let the person know.
  var lastSanitizeRemovedChars = false;
  function sanitizeForQr(str) {
    var cleaned = str.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "");
    lastSanitizeRemovedChars = cleaned.length !== str.length;
    return cleaned;
  }

  function hasMinimumData() {
    if (state.type === "wifi") return els.wSsid.value.trim().length > 0;
    if (state.type === "vcard") {
      return (
        els.vFirst.value.trim().length > 0 ||
        els.vLast.value.trim().length > 0 ||
        els.vPhone.value.trim().length > 0 ||
        els.vEmail.value.trim().length > 0
      );
    }
    return els.text.value.trim().length > 0;
  }

  /* ============================================
     Contrast check (relative luminance, WCAG-ish)
     ============================================ */
  function hexToRgb(hex) {
    var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return { r: 0, g: 0, b: 0 };
    return {
      r: parseInt(m[1], 16),
      g: parseInt(m[2], 16),
      b: parseInt(m[3], 16)
    };
  }

  function luminance(rgb) {
    function chan(c) {
      var v = c / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }
    return 0.2126 * chan(rgb.r) + 0.7152 * chan(rgb.g) + 0.0722 * chan(rgb.b);
  }

  function contrastRatio(hex1, hex2) {
    var l1 = luminance(hexToRgb(hex1));
    var l2 = luminance(hexToRgb(hex2));
    var lighter = Math.max(l1, l2);
    var darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  function updateContrastHint() {
    var ratio = contrastRatio(state.fg, state.bg);
    els.contrastHint.hidden = ratio >= 2.5;
  }

  /* ============================================
     QR rendering
     ============================================ */
  function correctLevelFor(letter) {
    var map = { L: "L", M: "M", Q: "Q", H: "H" };
    return window.QRCode.CorrectLevel[map[letter] || "M"];
  }

  function showMessage(text, isError) {
    var box = document.createElement("div");
    box.style.width = state.size + "px";
    box.style.height = state.size + "px";
    box.style.display = "flex";
    box.style.alignItems = "center";
    box.style.justifyContent = "center";
    box.style.color = isError ? "#E2A33D" : "#9aa0a6";
    box.style.fontFamily = "var(--font-body)";
    box.style.fontSize = "13px";
    box.style.textAlign = "center";
    box.style.padding = "20px";
    box.style.lineHeight = "1.5";
    box.textContent = text;
    holder.appendChild(box);
  }

  // Builds the QR code for the current payload. The library auto-picks a QR
  // version from the text length, which works correctly now that emoji/surrogate
  // pairs are stripped upstream in sanitizeForQr(). We still guard with try/catch
  // in case a payload is simply too large for even the biggest QR version (40) —
  // that's a real possibility with long URLs or big vCards, not a library bug.
  function buildQr(payload, correctLevel) {
    try {
      return new window.QRCode(holder, {
        text: payload,
        width: state.size,
        height: state.size,
        colorDark: state.fg,
        colorLight: state.bg,
        correctLevel: correctLevel
      });
    } catch (err) {
      holder.innerHTML = "";
      return null;
    }
  }

  function render() {
    var payload = buildPayload();
    var removedChars = lastSanitizeRemovedChars;
    holder.innerHTML = "";

    if (!hasMinimumData()) {
      showMessage(placeholderMessage(), false);
      qrInstance = null;
      updateCaption(null);
      toggleActionButtons(false);
      els.emojiHint.hidden = true;
      return;
    }

    var result = buildQr(payload, correctLevelFor(state.ec));

    if (!result) {
      holder.innerHTML = "";
      showMessage("This is too much data for a QR code, even at the largest size. Try a shorter link, a lower error-correction level, or less text.", true);
      qrInstance = null;
      updateCaption(null);
      toggleActionButtons(false);
      els.emojiHint.hidden = true;
      return;
    }

    qrInstance = result;
    updateCaption(payload);
    toggleActionButtons(true);
    els.emojiHint.hidden = !removedChars;
  }

  function placeholderMessage() {
    if (state.type === "wifi") return "Enter a network name to preview the code";
    if (state.type === "vcard") return "Enter at least a name, phone, or email";
    return "Type something above to generate a code";
  }

  function updateCaption(payload) {
    if (!payload) {
      els.caption.textContent = "Nothing to scan yet";
      return;
    }
    if (state.type === "wifi") {
      els.caption.textContent = els.wSsid.value.trim()
        ? "Scan to join \u201c" + els.wSsid.value.trim() + "\u201d"
        : "Scan to join this network";
    } else if (state.type === "vcard") {
      var name = (els.vFirst.value.trim() + " " + els.vLast.value.trim()).trim();
      els.caption.textContent = "Scan to save " + (name || "this contact");
    } else {
      var t = els.text.value.trim();
      els.caption.textContent = "Scan to open: " + (t.length > 48 ? t.slice(0, 48) + "\u2026" : t);
    }
  }

  function toggleActionButtons(enabled) {
    els.btnDownload.disabled = !enabled;
    els.btnCopy.disabled = !enabled;
    els.btnDownload.style.opacity = enabled ? "1" : "0.45";
    els.btnCopy.style.opacity = enabled ? "1" : "0.45";
    els.btnDownload.style.cursor = enabled ? "pointer" : "not-allowed";
    els.btnCopy.style.cursor = enabled ? "pointer" : "not-allowed";
  }

  function scheduleRender() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(render, 120);
  }

  /* ============================================
     Tab switching
     ============================================ */
  els.tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      var type = tab.getAttribute("data-type");
      state.type = type;

      els.tabs.forEach(function (t) {
        t.classList.toggle("is-active", t === tab);
        t.setAttribute("aria-selected", t === tab ? "true" : "false");
      });
      els.panels.forEach(function (p) {
        p.classList.toggle("is-active", p.getAttribute("data-panel") === type);
      });

      render();
    });
  });

  /* ============================================
     Wi-Fi: hide password field when "open" selected
     ============================================ */
  els.wSecurity.addEventListener("change", function () {
    els.wPassField.style.display = els.wSecurity.value === "nopass" ? "none" : "block";
    scheduleRender();
  });

  /* ============================================
     Input listeners -> live re-render
     ============================================ */
  [
    els.text, els.wSsid, els.wPass, els.wHidden,
    els.vFirst, els.vLast, els.vOrg, els.vPhone, els.vEmail, els.vUrl
  ].forEach(function (el) {
    var evt = el.type === "checkbox" ? "change" : "input";
    el.addEventListener(evt, scheduleRender);
  });

  /* ============================================
     Appearance controls
     ============================================ */
  els.size.addEventListener("input", function () {
    state.size = parseInt(els.size.value, 10);
    els.sizeVal.textContent = state.size + "px";
    scheduleRender();
  });

  els.ec.addEventListener("change", function () {
    state.ec = els.ec.value;
    scheduleRender();
  });

  function syncColor(inputEl, hexEl, key) {
    inputEl.addEventListener("input", function () {
      state[key] = inputEl.value.toUpperCase();
      hexEl.textContent = state[key];
      updateContrastHint();
      scheduleRender();
    });
  }
  syncColor(els.fg, els.fgHex, "fg");
  syncColor(els.bg, els.bgHex, "bg");

  /* ============================================
     Download as PNG
     ============================================ */
  function getCanvasOrImg() {
    var canvas = holder.querySelector("canvas");
    if (canvas) return canvas;
    var img = holder.querySelector("img");
    return img || null;
  }

  function toDataUrl(callback) {
    var canvas = holder.querySelector("canvas");
    if (canvas) {
      callback(canvas.toDataURL("image/png"));
      return;
    }
    // Fallback: library rendered an <img> (older browsers without canvas support)
    var img = holder.querySelector("img");
    if (img) {
      callback(img.src);
    }
  }

  els.btnDownload.addEventListener("click", function () {
    if (!qrInstance) return;
    toDataUrl(function (dataUrl) {
      var a = document.createElement("a");
      var filenameBase =
        state.type === "wifi" ? "wifi-qr" :
        state.type === "vcard" ? "contact-qr" : "qr-code";
      a.href = dataUrl;
      a.download = filenameBase + ".png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });
  });

  /* ============================================
     Copy image to clipboard
     ============================================ */
  els.btnCopy.addEventListener("click", function () {
    if (!qrInstance) return;
    var canvas = holder.querySelector("canvas");
    if (!canvas || !window.ClipboardItem || !navigator.clipboard) {
      showCopyFeedback("Copy isn't supported in this browser — try Download instead.");
      return;
    }
    canvas.toBlob(function (blob) {
      if (!blob) {
        showCopyFeedback("Couldn't copy — try Download instead.");
        return;
      }
      navigator.clipboard
        .write([new window.ClipboardItem({ "image/png": blob })])
        .then(function () {
          showCopyFeedback("Copied to clipboard.");
        })
        .catch(function () {
          showCopyFeedback("Couldn't copy — try Download instead.");
        });
    });
  });

  function showCopyFeedback(msg) {
    els.copyFeedback.textContent = msg;
    setTimeout(function () {
      els.copyFeedback.textContent = "";
    }, 3000);
  }

  /* ============================================
     Init
     ============================================ */
  els.wPassField.style.display = els.wSecurity.value === "nopass" ? "none" : "block";
  updateContrastHint();
  render();
})();
