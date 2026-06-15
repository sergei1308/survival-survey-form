"use strict";

const config = window.SURVEY_CONFIG || {};
const pendingKey = "survivalSurveyPendingResponse";
const form = document.getElementById("survey-form");
const successBox = document.getElementById("success-box");
const errorBox = document.getElementById("error-box");
const submitButton = document.getElementById("submit-button");
const ageInput = document.getElementById("age");
const educationInput = document.getElementById("education");
const probabilityInput = document.getElementById("probability");
const probabilitySlider = document.getElementById("probability-slider");
const probabilityLabel = document.getElementById("probability-label");

function targetAgeFor(age) {
  if (!Number.isInteger(age) || age < 25 || age > 95) return null;
  if (age < 60) return 70;
  return Math.floor(age / 10 + 2) * 10;
}

function updateTargetQuestion() {
  const targetAge = targetAgeFor(Number(ageInput.value));
  probabilityLabel.textContent = targetAge === null
    ? "Probability of surviving to the assigned target age *"
    : `What is your probability of surviving until age ${targetAge}? *`;
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = false;
}

function clearError() {
  errorBox.hidden = true;
  errorBox.textContent = "";
}

function setSaving(saving) {
  submitButton.disabled = saving;
  submitButton.textContent = saving ? "Saving..." : "OK - Submit response";
}

function validInteger(value, minimum, maximum) {
  return Number.isInteger(value) && value >= minimum && value <= maximum;
}

function buildPayload() {
  const gender = form.elements.gender.value;
  const age = Number(ageInput.value);
  const education = educationInput.value;
  const probability = Number(probabilityInput.value);
  if (!["female", "male"].includes(gender)) {
    throw new Error("Please select gender.");
  }
  if (!validInteger(age, 25, 95)) {
    throw new Error("Please enter a whole-number age from 25 to 95.");
  }
  if (!["primary", "secondary", "tertiary", "phd"].includes(education)) {
    throw new Error("Please select the highest education completed.");
  }
  if (!validInteger(probability, 0, 100)) {
    throw new Error("Please enter a whole-number probability from 0 to 100.");
  }
  return {
    response_id: crypto.randomUUID(),
    gender,
    age,
    education_completed: education,
    survival_probability_percent: probability,
    form_version: "2.0"
  };
}

function sleep(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function submitWithRetry(payload) {
  if (!config.submitUrl) {
    throw new Error("The survey submission service is not configured.");
  }
  let lastError = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const response = await fetch(config.submitUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok && result.saved === true) return result;
      if (response.status < 500 && response.status !== 429) {
        const error = new Error(result.error || "The response was rejected.");
        error.terminal = true;
        throw error;
      }
      lastError = new Error(result.error || "The service is temporarily busy.");
    } catch (error) {
      if (error.terminal) throw error;
      lastError = error;
    }
    if (attempt < 4) {
      await sleep(1000 * (2 ** attempt) + Math.random() * 500);
    }
  }
  throw lastError || new Error("The response could not be saved.");
}

function showSuccess(responseId) {
  document.getElementById("saved-response-id").textContent = responseId;
  form.hidden = true;
  successBox.hidden = false;
}

async function submitPending(payload) {
  setSaving(true);
  clearError();
  try {
    const result = await submitWithRetry(payload);
    localStorage.removeItem(pendingKey);
    showSuccess(result.response_id);
  } catch (error) {
    showError(`${error.message} Your response remains on this device; press Submit to retry.`);
  } finally {
    setSaving(false);
  }
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  clearError();
  let payload;
  try {
    const pending = localStorage.getItem(pendingKey);
    payload = pending ? JSON.parse(pending) : buildPayload();
    localStorage.setItem(pendingKey, JSON.stringify(payload));
  } catch (error) {
    showError(error.message);
    return;
  }
  await submitPending(payload);
});

ageInput.addEventListener("input", updateTargetQuestion);
probabilitySlider.addEventListener("input", () => {
  probabilityInput.value = probabilitySlider.value;
});
probabilityInput.addEventListener("input", () => {
  const value = Number(probabilityInput.value);
  if (Number.isFinite(value) && value >= 0 && value <= 100) {
    probabilitySlider.value = String(value);
  }
});

window.addEventListener("load", () => {
  updateTargetQuestion();
  const pending = localStorage.getItem(pendingKey);
  if (pending) {
    showError("A previous response is waiting to be saved. Press Submit to retry.");
  }
});
