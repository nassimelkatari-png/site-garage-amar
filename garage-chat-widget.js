/**
 * Garage Chat Widget
 * -------------------
 * Bulle de chat flottante autonome, à coller sur n'importe quelle page.
 *
 * Utilisation :
 *   <script
 *     src="garage-chat-widget.js"
 *     data-webhook-url="https://naredstudio.app.n8n.cloud/webhook/VOTRE-ID-WEBCHAT"
 *     data-garage-name="Garage Amar"
 *     defer
 *   ></script>
 *
 * Le webhook n8n doit répondre en JSON synchrone du type :
 *   { "reply": "texte de la réponse du bot" }
 */
(function () {
  "use strict";

  var scriptTag = document.currentScript;
  var WEBHOOK_URL = scriptTag.getAttribute("data-webhook-url") || "";
  var GARAGE_NAME = scriptTag.getAttribute("data-garage-name") || "Le garage";
  var SESSION_KEY = "garage_chat_session_id";

  function getSessionId() {
    try {
      var existing = sessionStorage.getItem(SESSION_KEY);
      if (existing) return existing;
      var fresh =
        "web-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10);
      sessionStorage.setItem(SESSION_KEY, fresh);
      return fresh;
    } catch (e) {
      return "web-" + Date.now();
    }
  }

  var CSS = "\
    .gw-root { position: fixed; right: 20px; bottom: 20px; z-index: 999999; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }\
    .gw-launcher { width: 58px; height: 58px; border-radius: 50%; background: #E8871E; border: none; cursor: pointer; box-shadow: 0 6px 18px rgba(0,0,0,.35); display: flex; align-items: center; justify-content: center; transition: transform .15s ease; }\
    .gw-launcher:hover { transform: scale(1.05); }\
    .gw-launcher svg { width: 26px; height: 26px; }\
    .gw-panel { position: absolute; right: 0; bottom: 74px; width: 360px; max-width: calc(100vw - 32px); height: 500px; max-height: calc(100vh - 120px); background: #14171C; border-radius: 14px; box-shadow: 0 20px 50px rgba(0,0,0,.45); display: flex; flex-direction: column; overflow: hidden; opacity: 0; transform: translateY(12px) scale(.98); pointer-events: none; transition: opacity .18s ease, transform .18s ease; }\
    .gw-panel.gw-open { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }\
    .gw-header { position: relative; padding: 16px 18px; background: #1C2128; border-bottom: 1px solid #262B33; overflow: hidden; }\
    .gw-header::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 3px; background: repeating-linear-gradient(135deg, #E8871E 0 10px, #1C2128 10px 20px); opacity: .5; }\
    .gw-header-title { color: #F5F1EA; font-size: 15px; font-weight: 700; margin: 0; }\
    .gw-header-status { color: #9AA1AC; font-size: 12.5px; margin: 3px 0 0; display: flex; align-items: center; gap: 6px; }\
    .gw-status-dot { width: 7px; height: 7px; border-radius: 50%; background: #4CAF6D; display: inline-block; }\
    .gw-close { position: absolute; top: 14px; right: 14px; background: none; border: none; color: #9AA1AC; cursor: pointer; padding: 4px; line-height: 0; }\
    .gw-close:hover { color: #F5F1EA; }\
    .gw-messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px; background: #14171C; }\
    .gw-msg { max-width: 82%; padding: 9px 13px; border-radius: 12px; font-size: 13.5px; line-height: 1.45; white-space: pre-wrap; word-wrap: break-word; }\
    .gw-msg-bot { align-self: flex-start; background: #262B33; color: #F5F1EA; border-bottom-left-radius: 3px; }\
    .gw-msg-user { align-self: flex-end; background: #E8871E; color: #1C2128; font-weight: 500; border-bottom-right-radius: 3px; }\
    .gw-typing { align-self: flex-start; display: flex; gap: 4px; padding: 10px 13px; background: #262B33; border-radius: 12px; border-bottom-left-radius: 3px; }\
    .gw-typing span { width: 6px; height: 6px; border-radius: 50%; background: #9AA1AC; animation: gw-bounce 1.2s infinite ease-in-out; }\
    .gw-typing span:nth-child(2) { animation-delay: .15s; }\
    .gw-typing span:nth-child(3) { animation-delay: .3s; }\
    @keyframes gw-bounce { 0%, 60%, 100% { transform: translateY(0); opacity: .5; } 30% { transform: translateY(-4px); opacity: 1; } }\
    .gw-inputrow { display: flex; align-items: flex-end; gap: 8px; padding: 12px; border-top: 1px solid #262B33; background: #1C2128; }\
    .gw-input { flex: 1; resize: none; background: #262B33; color: #F5F1EA; border: 1px solid #333944; border-radius: 10px; padding: 9px 11px; font-size: 13.5px; font-family: inherit; max-height: 90px; outline: none; }\
    .gw-input:focus { border-color: #E8871E; }\
    .gw-input::placeholder { color: #6B7280; }\
    .gw-send { background: #E8871E; border: none; border-radius: 10px; width: 38px; height: 38px; flex-shrink: 0; cursor: pointer; display: flex; align-items: center; justify-content: center; }\
    .gw-send:disabled { opacity: .5; cursor: default; }\
    .gw-send svg { width: 17px; height: 17px; }\
    @media (prefers-reduced-motion: reduce) { .gw-panel, .gw-launcher { transition: none; } }\
  ";

  function injectStyles() {
    var style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function el(tag, className, html) {
    var e = document.createElement(tag);
    if (className) e.className = className;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function buildWidget() {
    var root = el("div", "gw-root");

    var launcher = el(
      "button",
      "gw-launcher",
      '<svg viewBox="0 0 24 24" fill="none" stroke="#1C2128" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5H8L3 21l1.5-4.5A8.38 8.38 0 0 1 12.5 3a8.38 8.38 0 0 1 8.5 8.5Z"></path></svg>'
    );
    launcher.setAttribute("aria-label", "Ouvrir le chat");

    var panel = el("div", "gw-panel");

    var header = el("div", "gw-header");
    var title = el("p", "gw-header-title", GARAGE_NAME);
    var status = el(
      "p",
      "gw-header-status",
      '<span class="gw-status-dot"></span>Répond en quelques secondes'
    );
    var closeBtn = el(
      "button",
      "gw-close",
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>'
    );
    closeBtn.setAttribute("aria-label", "Fermer le chat");
    header.appendChild(title);
    header.appendChild(status);
    header.appendChild(closeBtn);

    var messages = el("div", "gw-messages");

    var inputRow = el("div", "gw-inputrow");
    var textarea = el("textarea", "gw-input");
    textarea.rows = 1;
    textarea.placeholder = "Écrivez votre message…";
    var sendBtn = el(
      "button",
      "gw-send",
      '<svg viewBox="0 0 24 24" fill="none" stroke="#1C2128" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/></svg>'
    );
    inputRow.appendChild(textarea);
    inputRow.appendChild(sendBtn);

    panel.appendChild(header);
    panel.appendChild(messages);
    panel.appendChild(inputRow);

    root.appendChild(panel);
    root.appendChild(launcher);
    document.body.appendChild(root);

    return { root: root, launcher: launcher, panel: panel, closeBtn: closeBtn, messages: messages, textarea: textarea, sendBtn: sendBtn };
  }

  function addMessage(container, text, from) {
    var msg = el("div", "gw-msg " + (from === "user" ? "gw-msg-user" : "gw-msg-bot"), escapeHtml(text));
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
    return msg;
  }

  function escapeHtml(str) {
    var d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  function addTyping(container) {
    var t = el("div", "gw-typing", "<span></span><span></span><span></span>");
    container.appendChild(t);
    container.scrollTop = container.scrollHeight;
    return t;
  }

  function init() {
    injectStyles();
    var ui = buildWidget();
    var sessionId = getSessionId();
    var hasGreeted = false;

    function openPanel() {
      ui.panel.classList.add("gw-open");
      if (!hasGreeted) {
        hasGreeted = true;
        addMessage(
          ui.messages,
          "Bonjour ! 👋 Posez-moi vos questions sur nos véhicules en stock, un rendez-vous, ou toute autre question.",
          "bot"
        );
      }
      ui.textarea.focus();
    }

    function closePanel() {
      ui.panel.classList.remove("gw-open");
    }

    ui.launcher.addEventListener("click", function () {
      if (ui.panel.classList.contains("gw-open")) {
        closePanel();
      } else {
        openPanel();
      }
    });
    ui.closeBtn.addEventListener("click", closePanel);

    ui.textarea.addEventListener("input", function () {
      ui.textarea.style.height = "auto";
      ui.textarea.style.height = Math.min(ui.textarea.scrollHeight, 90) + "px";
    });

    ui.textarea.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    });
    ui.sendBtn.addEventListener("click", send);

    function send() {
      var text = ui.textarea.value.trim();
      if (!text || !WEBHOOK_URL) return;

      addMessage(ui.messages, text, "user");
      ui.textarea.value = "";
      ui.textarea.style.height = "auto";
      ui.sendBtn.disabled = true;

      var typingEl = addTyping(ui.messages);

      fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId: sessionId }),
      })
        .then(function (res) {
          return res.json();
        })
        .then(function (data) {
          typingEl.remove();
          var reply =
            (data && (data.reply || data.output)) ||
            "Désolé, je n'ai pas pu traiter votre demande.";
          addMessage(ui.messages, reply, "bot");
        })
        .catch(function () {
          typingEl.remove();
          addMessage(
            ui.messages,
            "Une erreur est survenue, réessayez dans un instant.",
            "bot"
          );
        })
        .finally(function () {
          ui.sendBtn.disabled = false;
        });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
