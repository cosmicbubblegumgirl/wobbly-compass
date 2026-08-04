(() => {
  "use strict";

  const form = document.querySelector("#explorerForm");
  const steps = [...document.querySelectorAll(".form-step")];
  const navItems = [...document.querySelectorAll("#stepNav li")];
  const backButton = document.querySelector("#backButton");
  const nextButton = document.querySelector("#nextButton");
  const submitButton = document.querySelector("#submitButton");
  const formError = document.querySelector("#formError");
  const progressNumber = document.querySelector("#progressNumber");
  const draftStatus = document.querySelector("#draftStatus");
  const successPanel = document.querySelector("#successPanel");
  const trailMap = document.querySelector(".trail-map");
  const photoInput = document.querySelector("#photo");
  const photoPreview = document.querySelector("#photoPreview");
  const photoConsentWrap = document.querySelector("#photoConsentWrap");
  const dropZone = document.querySelector("#dropZone");
  const dropTitle = document.querySelector("#dropTitle");
  const draftKey = "wobbly-compass-field-notes-v1";
  const startedAt = Date.now();
  let currentStep = 0;
  let furthestStep = 0;
  let saveTimer;

  const hostedSupabaseUrl = "__SUPABASE_URL__";
  const hostedSupabaseKey = "__SUPABASE_PUBLISHABLE_KEY__";
  const supabaseUrl = window.WOBBLY_COMPASS_SUPABASE_URL ||
    (location.hostname.endsWith(".github.io") ? hostedSupabaseUrl : "");
  const supabaseKey = window.WOBBLY_COMPASS_SUPABASE_KEY ||
    (location.hostname.endsWith(".github.io") ? hostedSupabaseKey : "");

  function valuesFor(name) {
    return [...form.querySelectorAll(`[name="${name}"]:checked`)].map((input) => input.value);
  }

  function collectData() {
    const get = (name) => form.elements.namedItem(name);
    const checkedValue = (name) => form.querySelector(`[name="${name}"]:checked`)?.value || "";
    return {
      anonymousTag: get("anonymousTag").value.trim(),
      journeyStage: checkedValue("journeyStage"),
      responsibilities: valuesFor("responsibilities"),
      ageConfirmed: get("ageConfirmed").checked,
      consentResearch: get("consentResearch").checked,
      capacityFrequency: checkedValue("capacityFrequency"),
      planChangeStory: get("planChangeStory").value.trim(),
      firstMove: checkedValue("firstMove"),
      currentTools: valuesFor("currentTools"),
      hardestPart: checkedValue("hardestPart"),
      pressureResponse: checkedValue("pressureResponse"),
      capacitySnapshot: {
        time: Number(get("timeLevel").value),
        energy: Number(get("energyLevel").value),
        focus: Number(get("focusLevel").value),
      },
      helpfulSupport: get("helpfulSupport").value.trim(),
      connectionReality: checkedValue("connectionReality"),
      comfortableData: valuesFor("comfortableData"),
      consentPhoto: get("consentPhoto").checked,
      finalNote: get("finalNote").value.trim(),
      durationSeconds: Math.round((Date.now() - startedAt) / 1000),
    };
  }

  function databaseRow(data, id, photo) {
    return {
      id,
      anonymous_tag: data.anonymousTag || null,
      journey_stage: data.journeyStage,
      responsibilities: data.responsibilities,
      age_confirmed: data.ageConfirmed,
      consent_research: data.consentResearch,
      capacity_frequency: data.capacityFrequency || null,
      plan_change_story: data.planChangeStory || null,
      first_move: data.firstMove || null,
      current_tools: data.currentTools,
      hardest_part: data.hardestPart || null,
      pressure_response: data.pressureResponse || null,
      capacity_snapshot: data.capacitySnapshot,
      helpful_support: data.helpfulSupport || null,
      connection_reality: data.connectionReality || null,
      comfortable_data: data.comfortableData,
      consent_photo: data.consentPhoto,
      final_note: data.finalNote || null,
      duration_seconds: data.durationSeconds,
      photo_path: photo?.path || null,
      photo_name: photo?.name || null,
      photo_type: photo?.type || null,
    };
  }

  async function responseMessage(response) {
    const result = await response.json().catch(() => ({}));
    return result.message || result.error_description || result.error || "The notebook did not answer.";
  }

  async function uploadPhoto(file, responseId) {
    if (!file) return null;
    const extensions = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
    };
    const extension = extensions[file.type];
    if (!extension) throw new Error("Choose a JPG, PNG, WEBP, or GIF picture.");

    const path = `${responseId}/field-image.${extension}`;
    const response = await fetch(`${supabaseUrl}/storage/v1/object/field-notes/${path}`, {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": file.type,
        "x-upsert": "false",
      },
      body: file,
    });
    if (!response.ok) throw new Error(await responseMessage(response));
    return { path, name: file.name.slice(0, 255), type: file.type };
  }

  async function storeResponse(data, photoFile) {
    const responseId = crypto.randomUUID();
    const photo = await uploadPhoto(photoFile, responseId);
    const response = await fetch(`${supabaseUrl}/rest/v1/explorer_responses`, {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(databaseRow(data, responseId, photo)),
    });
    if (!response.ok) throw new Error(await responseMessage(response));
    return responseId.slice(0, 8).toUpperCase();
  }

  function saveDraft() {
    const data = collectData();
    data.consentPhoto = false;
    localStorage.setItem(draftKey, JSON.stringify(data));
    draftStatus.textContent = "Draft tucked safely on this device.";
  }

  function queueDraft() {
    clearTimeout(saveTimer);
    draftStatus.textContent = "Tucking away this draft…";
    saveTimer = setTimeout(saveDraft, 350);
  }

  function restoreDraft() {
    let draft;
    try { draft = JSON.parse(localStorage.getItem(draftKey)); } catch { return; }
    if (!draft || typeof draft !== "object") return;

    for (const [name, value] of Object.entries(draft)) {
      if (name === "capacitySnapshot" && value) {
        for (const part of ["time", "energy", "focus"]) {
          const slider = form.elements.namedItem(`${part}Level`);
          if (slider && value[part]) slider.value = value[part];
        }
        continue;
      }
      const fields = [...form.querySelectorAll(`[name="${name}"]`)];
      for (const field of fields) {
        if (field.type === "checkbox") field.checked = Array.isArray(value) ? value.includes(field.value) : value === true;
        else if (field.type === "radio") field.checked = field.value === value;
        else field.value = value ?? "";
      }
    }
    draftStatus.textContent = "Your earlier draft is back on the map.";
    updateLiveDetails();
  }

  function updateLiveDetails() {
    for (const output of document.querySelectorAll("[data-count-for]")) {
      const field = document.getElementById(output.dataset.countFor);
      output.textContent = `${field.value.length} / ${field.maxLength}`;
    }
    for (const slider of form.querySelectorAll('input[type="range"]')) {
      const output = form.querySelector(`output[for="${slider.id}"]`);
      if (output) output.textContent = `${slider.value} / 5`;
    }
  }

  function showError(message, question) {
    formError.textContent = message;
    formError.hidden = false;
    if (question) {
      question.classList.add("invalid-question");
      question.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function clearErrors() {
    formError.hidden = true;
    formError.textContent = "";
    document.querySelectorAll(".invalid-question").forEach((item) => item.classList.remove("invalid-question"));
  }

  function validateStep(index) {
    clearErrors();
    const step = steps[index];
    for (const group of step.querySelectorAll(".checks-required")) {
      if (!group.querySelector('input[type="checkbox"]:checked')) {
        showError("Choose at least one option before the next landmark.", group);
        return false;
      }
    }
    for (const field of step.querySelectorAll("input, textarea")) {
      if (!field.checkValidity()) {
        const question = field.closest(".question, .consent-card") || step;
        showError(field.validity.tooShort ? "A little more detail will make this field note useful." : "There is one small blank on this part of the map.", question);
        field.focus({ preventScroll: true });
        return false;
      }
    }
    if (index === 3 && photoInput.files.length && !form.elements.namedItem("consentPhoto").checked) {
      showError("Confirm the photo note, or remove the picture before sending.", photoConsentWrap);
      return false;
    }
    return true;
  }

  function showStep(index, focus = true) {
    currentStep = Math.max(0, Math.min(steps.length - 1, index));
    furthestStep = Math.max(furthestStep, currentStep);
    steps.forEach((step, i) => {
      const active = i === currentStep;
      step.hidden = !active;
      step.classList.toggle("active", active);
    });
    navItems.forEach((item, i) => {
      item.classList.toggle("active", i === currentStep);
      item.classList.toggle("done", i < currentStep);
      item.querySelector("button").disabled = i > furthestStep;
    });
    progressNumber.textContent = `${(currentStep + 1) * 25}%`;
    backButton.hidden = currentStep === 0;
    nextButton.hidden = currentStep === steps.length - 1;
    submitButton.hidden = currentStep !== steps.length - 1;
    clearErrors();
    saveDraft();
    if (focus) {
      document.querySelector("#interview").scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(() => steps[currentStep].querySelector("h3")?.focus?.(), 250);
    }
  }

  function usePhoto(file) {
    if (!file) return;
    if (file.size > 5_000_000) {
      photoInput.value = "";
      showError("That picture is larger than 5 MB. Choose a smaller postcard.", photoInput.closest(".question"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      photoPreview.src = reader.result;
      photoPreview.hidden = false;
      dropTitle.textContent = file.name;
      photoConsentWrap.hidden = false;
    };
    reader.readAsDataURL(file);
  }

  form.addEventListener("input", () => {
    clearErrors();
    updateLiveDetails();
    queueDraft();
  });
  form.addEventListener("change", queueDraft);

  nextButton.addEventListener("click", () => {
    if (validateStep(currentStep)) showStep(currentStep + 1);
  });
  backButton.addEventListener("click", () => showStep(currentStep - 1));
  document.querySelector("#stepNav").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-goto]");
    if (!button || button.disabled) return;
    showStep(Number(button.dataset.goto));
  });

  photoInput.addEventListener("change", () => usePhoto(photoInput.files[0]));
  for (const eventName of ["dragenter", "dragover"]) {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.add("dragging");
    });
  }
  for (const eventName of ["dragleave", "drop"]) {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.remove("dragging");
    });
  }
  dropZone.addEventListener("drop", (event) => {
    const file = event.dataTransfer.files[0];
    if (!file) return;
    const transfer = new DataTransfer();
    transfer.items.add(file);
    photoInput.files = transfer.files;
    usePhoto(file);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!validateStep(currentStep)) return;
    if (!supabaseUrl.startsWith("https://") || !supabaseKey.startsWith("sb_publishable_")) {
      showError("The field notebook is still being connected. Please try again shortly.");
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Sending the dispatch…";

    try {
      const reference = await storeResponse(collectData(), photoInput.files[0]);
      localStorage.removeItem(draftKey);
      form.hidden = true;
      trailMap.hidden = true;
      successPanel.hidden = false;
      document.querySelector("#referenceCode").textContent = reference;
      successPanel.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (error) {
      showError(error.message || "The route went quiet. Check your connection and try again.");
    } finally {
      submitButton.disabled = false;
      submitButton.innerHTML = 'Send field notes <span aria-hidden="true">↗</span>';
    }
  });

  document.querySelector("#restartButton").addEventListener("click", () => {
    form.reset();
    photoPreview.hidden = true;
    photoPreview.removeAttribute("src");
    photoConsentWrap.hidden = true;
    dropTitle.textContent = "Drop a picture here";
    form.hidden = false;
    trailMap.hidden = false;
    successPanel.hidden = true;
    furthestStep = 0;
    showStep(0);
    updateLiveDetails();
  });

  restoreDraft();
  updateLiveDetails();
  showStep(0, false);
})();
