// Embeddable Smart Lead Form widget powered by backend JSON configuration.

(function () {
  "use strict";

  var widgetConfig = window.SmartLeadFormConfig || {};
  var apiBaseUrl = widgetConfig.apiBaseUrl || "http://localhost:8000";
  var clientId = widgetConfig.clientId || "notary_demo";

  var state = {
    config: null,
    uiTexts: {},
    steps: [],
    visibleSteps: [],
    currentStepIndex: 0,
    answers: {},
    estimate: null,
    isOpen: false,
    screen: "welcome",
    error: "",
    isSubmitting: false
  };

  var elements = {};

  function createElement(tagName, className, text) {
    var element = document.createElement(tagName);
    if (className) {
      element.className = className;
    }
    if (text !== undefined && text !== null) {
      element.textContent = text;
    }
    return element;
  }

  function getText(key, fallback) {
    return state.uiTexts[key] || fallback;
  }

  function getLabel(group, value) {
    if (!value) {
      return "-";
    }

    var labels = state.uiTexts.labels || {};
    var groupLabels = labels[group] || {};
    return groupLabels[value] || value;
  }

  function getSummaryLabel(key, fallback) {
    var labels = state.uiTexts.summary_labels || {};
    return labels[key] || fallback;
  }

  function apiUrl(path) {
    return apiBaseUrl.replace(/\/$/, "") + path;
  }

  function conditionMatches(condition, answers) {
    if (!condition || !condition.key) {
      return false;
    }

    return answers[condition.key] === condition.equals;
  }

  function stepIsVisible(step, answers) {
    if (!step.show_if && !step.show_if_any) {
      return true;
    }

    if (step.show_if) {
      return conditionMatches(step.show_if, answers);
    }

    if (step.show_if_any) {
      return step.show_if_any.some(function (condition) {
        return conditionMatches(condition, answers);
      });
    }

    return false;
  }

  function updateVisibleSteps() {
    var currentStep = state.visibleSteps[state.currentStepIndex];
    state.visibleSteps = state.steps.filter(function (step) {
      return stepIsVisible(step, state.answers);
    });

    if (currentStep) {
      var nextIndex = state.visibleSteps.findIndex(function (step) {
        return step.key === currentStep.key;
      });
      if (nextIndex >= 0) {
        state.currentStepIndex = nextIndex;
      } else if (state.currentStepIndex >= state.visibleSteps.length) {
        state.currentStepIndex = Math.max(state.visibleSteps.length - 1, 0);
      }
    }
  }

  function validateEmail(value) {
    if (!value) {
      return true;
    }

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function validatePhone(value) {
    var cleaned = String(value || "")
      .replace(/\s+/g, "")
      .replace(/-/g, "")
      .replace(/\(/g, "")
      .replace(/\)/g, "");

    return /^05\d{8}$/.test(cleaned) || /^\+9725\d{8}$/.test(cleaned) || /^9725\d{8}$/.test(cleaned);
  }

  function formatEstimate(estimate) {
    var currency = estimate.currency || "₪";

    if (estimate.estimated_price_min !== null && estimate.estimated_price_max !== null) {
      return getText("estimate_price_prefix", "Ориентировочная стоимость") + ": " + estimate.estimated_price_min + "–" + estimate.estimated_price_max + " " + currency;
    }

    if (estimate.estimated_price_min !== null) {
      return getText("estimate_price_from_prefix", "Ориентировочная стоимость: от") + " " + estimate.estimated_price_min + " " + currency;
    }

    return getText("no_price_title", "Стоимость нужно уточнить");
  }

  function setError(message) {
    state.error = message || "";
    render();
  }

  function openModal() {
    state.isOpen = true;
    render();
  }

  function closeModal() {
    state.isOpen = false;
    render();
  }

  function startForm() {
    state.screen = "question";
    state.currentStepIndex = 0;
    state.error = "";
    updateVisibleSteps();
    render();
  }

  function goBack() {
    state.error = "";

    if (state.screen === "estimate") {
      state.screen = "question";
      state.currentStepIndex = Math.max(state.visibleSteps.length - 1, 0);
      render();
      return;
    }

    if (state.screen !== "question") {
      state.screen = "welcome";
      render();
      return;
    }

    if (state.currentStepIndex <= 0) {
      state.screen = "welcome";
    } else {
      state.currentStepIndex -= 1;
    }

    render();
  }

  function saveTextAnswer(step) {
    var input = elements.body.querySelector("[data-slf-input]");
    var value = input ? input.value.trim() : "";

    if (step.required && !value) {
      setError(getText("required_field_error", "Пожалуйста, заполните обязательное поле."));
      return;
    }

    if (step.type === "email" && !validateEmail(value)) {
      setError(getText("email_error", "Пожалуйста, укажите корректный email или оставьте поле пустым."));
      return;
    }

    if (step.type === "phone" && !validatePhone(value)) {
      setError(getText("phone_error", "Пожалуйста, укажите корректный номер телефона."));
      return;
    }

    state.answers[step.key] = value;
    state.error = "";
    goNext();
  }

  function goNext() {
    updateVisibleSteps();

    if (state.currentStepIndex < state.visibleSteps.length - 1) {
      state.currentStepIndex += 1;
      render();
      return;
    }

    calculateEstimate();
  }

  function answerOption(step, value) {
    state.answers[step.key] = value;
    state.error = "";
    updateVisibleSteps();
    goNext();
  }

  function requestJson(path, options) {
    return fetch(apiUrl(path), options).then(function (response) {
      return response.json().catch(function () {
        return {};
      }).then(function (data) {
        if (!response.ok) {
          var message = data.detail || data.message || response.statusText;
          throw new Error(message);
        }
        return data;
      });
    });
  }

  function loadConfig() {
    return requestJson("/api/form/config?client_id=" + encodeURIComponent(clientId))
      .then(function (config) {
        state.config = config;
        state.uiTexts = config.ui_texts || {};
        state.steps = config.steps || [];
        state.visibleSteps = config.visible_steps || state.steps.filter(function (step) {
          return stepIsVisible(step, state.answers);
        });
        elements.openButton.textContent = getText("open_button_text", "Оставить заявку");
        render();
      })
      .catch(function () {
        state.error = "Не удалось загрузить форму. Попробуйте позже.";
        elements.openButton.textContent = "Оставить заявку";
        render();
      });
  }

  function calculateEstimate() {
    state.error = "";
    state.isSubmitting = true;
    render();

    requestJson("/api/form/calculate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        client_id: clientId,
        scenario_key: state.config.scenario_key,
        answers: state.answers
      })
    })
      .then(function (estimate) {
        state.estimate = estimate;
        state.screen = "estimate";
        state.isSubmitting = false;
        render();
      })
      .catch(function () {
        state.isSubmitting = false;
        setError("Не удалось получить предварительную оценку. Попробуйте позже.");
      });
  }

  function submitLead() {
    if (!state.estimate) {
      setError("Не удалось отправить заявку. Попробуйте позже.");
      return;
    }

    state.isSubmitting = true;
    state.error = "";
    render();

    requestJson("/api/leads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        client_id: clientId,
        scenario_key: state.config.scenario_key,
        service_type: state.answers.service_type || null,
        language_pair: state.answers.language_pair || null,
        page_count: state.answers.page_count || null,
        urgency: state.answers.urgency || null,
        meeting_format: state.answers.meeting_format || null,
        city: state.answers.city || null,
        documents_ready: state.answers.documents_ready || null,
        name: state.answers.name,
        phone: state.answers.phone,
        email: state.answers.email || null,
        preferred_contact_time: state.answers.preferred_contact_time || null,
        comment: state.answers.comment || null,
        estimated_price_min: state.estimate.estimated_price_min,
        estimated_price_max: state.estimate.estimated_price_max,
        currency: state.estimate.currency,
        estimate_message: state.estimate.estimate_message,
        disclaimer: state.estimate.disclaimer,
        answers: state.answers
      })
    })
      .then(function () {
        state.screen = "success";
        state.isSubmitting = false;
        render();
      })
      .catch(function (error) {
        state.isSubmitting = false;
        setError(error.message || "Не удалось отправить заявку. Попробуйте позже.");
      });
  }

  function renderError(container) {
    if (!state.error) {
      return;
    }

    container.appendChild(createElement("div", "slf-error", state.error));
  }

  function renderWelcome() {
    var fragment = document.createDocumentFragment();
    fragment.appendChild(createElement("h2", "slf-heading", getText("welcome_title", state.config ? state.config.title : "Заявка")));
    fragment.appendChild(createElement("p", "slf-text", getText("welcome_text", state.config ? state.config.description : "")));
    renderError(fragment);
    elements.body.replaceChildren(fragment);

    var startButton = createElement("button", "slf-button slf-button-primary", getText("start_button_text", "Начать"));
    startButton.type = "button";
    startButton.addEventListener("click", startForm);
    elements.footer.replaceChildren(startButton);
  }

  function renderQuestion() {
    var step = state.visibleSteps[state.currentStepIndex];
    var fragment = document.createDocumentFragment();

    if (!step) {
      renderWelcome();
      return;
    }

    fragment.appendChild(createElement("div", "slf-progress", (state.currentStepIndex + 1) + " / " + state.visibleSteps.length));
    fragment.appendChild(createElement("h2", "slf-question", step.question));

    if (step.type === "single_choice") {
      var options = createElement("div", "slf-options");
      (step.options || []).forEach(function (option) {
        var optionButton = createElement("button", "slf-option-button", option.label);
        optionButton.type = "button";
        if (state.answers[step.key] === option.value) {
          optionButton.classList.add("slf-selected");
        }
        optionButton.addEventListener("click", function () {
          answerOption(step, option.value);
        });
        options.appendChild(optionButton);
      });
      fragment.appendChild(options);
    } else {
      var input;
      if (step.type === "textarea") {
        input = createElement("textarea", "slf-textarea");
      } else {
        input = createElement("input", "slf-input");
        input.type = step.type === "phone" ? "tel" : step.type;
      }
      input.setAttribute("data-slf-input", "true");
      input.placeholder = step.placeholder || "";
      input.value = state.answers[step.key] || "";
      fragment.appendChild(input);
    }

    renderError(fragment);
    elements.body.replaceChildren(fragment);

    var buttons = [];
    var backButton = createElement("button", "slf-button", getText("back_button_text", "Назад"));
    backButton.type = "button";
    backButton.addEventListener("click", goBack);
    buttons.push(backButton);

    if (step.type !== "single_choice") {
      var nextButton = createElement("button", "slf-button slf-button-primary", getText("next_button_text", "Далее"));
      nextButton.type = "button";
      nextButton.addEventListener("click", function () {
        saveTextAnswer(step);
      });
      buttons.push(nextButton);
    }

    elements.footer.replaceChildren.apply(elements.footer, buttons);
  }

  function renderEstimate() {
    var fragment = document.createDocumentFragment();
    var estimateBox = createElement("div", "slf-estimate");

    fragment.appendChild(createElement("h2", "slf-heading", getText("estimate_title", "Предварительная оценка")));
    estimateBox.appendChild(createElement("p", "slf-estimate-value", formatEstimate(state.estimate)));
    estimateBox.appendChild(createElement("p", "slf-text", state.estimate.estimate_message || ""));
    estimateBox.appendChild(createElement("p", "slf-text", state.estimate.disclaimer || ""));
    fragment.appendChild(estimateBox);
    renderError(fragment);
    elements.body.replaceChildren(fragment);

    var backButton = createElement("button", "slf-button", getText("back_button_text", "Назад"));
    backButton.type = "button";
    backButton.addEventListener("click", goBack);

    var submitButton = createElement("button", "slf-button slf-button-primary", state.isSubmitting ? getText("loading_text", "Пожалуйста, подождите...") : getText("submit_button_text", "Отправить заявку"));
    submitButton.type = "button";
    submitButton.disabled = state.isSubmitting;
    submitButton.addEventListener("click", submitLead);

    elements.footer.replaceChildren(backButton, submitButton);
  }

  function addSummaryRow(container, label, value) {
    if (!value || value === "-") {
      return;
    }

    var row = createElement("div", "slf-summary-row");
    row.appendChild(createElement("div", "slf-summary-label", label));
    row.appendChild(createElement("div", "slf-summary-value", value));
    container.appendChild(row);
  }

  function renderSuccess() {
    var fragment = document.createDocumentFragment();
    var summary = createElement("div", "slf-summary");

    fragment.appendChild(createElement("h2", "slf-heading", getText("success_title", "Спасибо, заявка создана")));
    fragment.appendChild(createElement("p", "slf-text", getText("success_text", "Ваша заявка отправлена.")));
    fragment.appendChild(createElement("h3", "slf-question", getText("summary_title", "Ваши данные")));

    addSummaryRow(summary, getSummaryLabel("service_type", "Услуга"), getLabel("service_type", state.answers.service_type));
    addSummaryRow(summary, getSummaryLabel("language_pair", "Язык"), getLabel("language_pair", state.answers.language_pair));
    addSummaryRow(summary, getSummaryLabel("page_count", "Страниц"), getLabel("page_count", state.answers.page_count));
    addSummaryRow(summary, getSummaryLabel("urgency", "Срочность"), getLabel("urgency", state.answers.urgency));
    addSummaryRow(summary, getSummaryLabel("meeting_format", "Формат связи"), getLabel("meeting_format", state.answers.meeting_format));
    addSummaryRow(summary, getSummaryLabel("city", "Город"), getLabel("city", state.answers.city));
    addSummaryRow(summary, getSummaryLabel("documents_ready", "Документы"), getLabel("documents_ready", state.answers.documents_ready));
    addSummaryRow(summary, getSummaryLabel("name", "Имя"), state.answers.name || "-");
    addSummaryRow(summary, getSummaryLabel("phone", "Телефон"), state.answers.phone || "-");
    addSummaryRow(summary, getSummaryLabel("email", "Email"), state.answers.email || "-");
    addSummaryRow(summary, getSummaryLabel("preferred_contact_time", "Удобное время"), state.answers.preferred_contact_time || "-");
    addSummaryRow(summary, getSummaryLabel("comment", "Комментарий"), state.answers.comment || "-");

    fragment.appendChild(summary);
    elements.body.replaceChildren(fragment);

    var closeButton = createElement("button", "slf-button slf-button-primary", getText("close_button_text", "Закрыть"));
    closeButton.type = "button";
    closeButton.addEventListener("click", closeModal);
    elements.footer.replaceChildren(closeButton);
  }

  function renderLoading() {
    elements.body.replaceChildren(createElement("p", "slf-text", getText("loading_text", "Пожалуйста, подождите...")));
    elements.footer.replaceChildren();
  }

  function render() {
    elements.overlay.classList.toggle("slf-is-open", state.isOpen);
    elements.openButton.textContent = getText("open_button_text", "Оставить заявку");

    if (!state.isOpen) {
      return;
    }

    elements.title.textContent = state.config ? state.config.title : "Smart Lead Form";

    if (!state.config) {
      renderLoading();
      if (state.error) {
        elements.body.appendChild(createElement("div", "slf-error", state.error));
      }
      return;
    }

    if (state.screen === "welcome") {
      renderWelcome();
    } else if (state.screen === "question") {
      renderQuestion();
    } else if (state.screen === "estimate") {
      renderEstimate();
    } else if (state.screen === "success") {
      renderSuccess();
    }
  }

  function buildWidget() {
    elements.openButton = createElement("button", "slf-widget-button", "Оставить заявку");
    elements.openButton.type = "button";
    elements.openButton.addEventListener("click", openModal);

    elements.overlay = createElement("div", "slf-overlay");
    elements.modal = createElement("div", "slf-modal");
    elements.header = createElement("div", "slf-header");
    elements.title = createElement("h1", "slf-title", "Smart Lead Form");
    elements.closeButton = createElement("button", "slf-close-button", "×");
    elements.closeButton.type = "button";
    elements.closeButton.setAttribute("aria-label", "Закрыть");
    elements.closeButton.addEventListener("click", closeModal);
    elements.body = createElement("div", "slf-body");
    elements.footer = createElement("div", "slf-footer");

    elements.header.appendChild(elements.title);
    elements.header.appendChild(elements.closeButton);
    elements.modal.appendChild(elements.header);
    elements.modal.appendChild(elements.body);
    elements.modal.appendChild(elements.footer);
    elements.overlay.appendChild(elements.modal);

    elements.overlay.addEventListener("click", function (event) {
      if (event.target === elements.overlay) {
        closeModal();
      }
    });

    document.body.appendChild(elements.openButton);
    document.body.appendChild(elements.overlay);
  }

  function init() {
    buildWidget();
    render();
    loadConfig();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
