const API_BASE_URL = "https://aicdr1v459.execute-api.ap-southeast-2.amazonaws.com";

let availableFlags = [];

const flagForm = document.getElementById("flagForm");
const formMessage = document.getElementById("formMessage");
const flagsTableBody = document.getElementById("flagsTableBody");
const refreshFlagsBtn = document.getElementById("refreshFlagsBtn");

const flagSelect = document.getElementById("flagSelect");
const checkFlagBtn = document.getElementById("checkFlagBtn");
const reloadDemoFlagsBtn = document.getElementById("reloadDemoFlagsBtn");
const flagMeta = document.getElementById("flagMeta");
const demoResult = document.getElementById("demoResult");

function showFormMessage(message, type) {
  formMessage.style.display = "block";
  formMessage.className = `message ${type}`;
  formMessage.textContent = message;
}

function hideFormMessage() {
  formMessage.style.display = "none";
}

function getFeatureName(flag) {
  return flag.featureName || flag.feature_name || "";
}

function getDescription(flag) {
  return flag.description || "";
}

function getUpdatedAt(flag) {
  return flag.updatedAt || flag.updated_at || "";
}

function isEnabled(flag) {
  if (typeof flag.enabled === "boolean") return flag.enabled;

  const rawStatus = String(flag.status || "").trim().toLowerCase();
  if (rawStatus === "enabled" || rawStatus === "on" || rawStatus === "true") return true;
  if (rawStatus === "disabled" || rawStatus === "off" || rawStatus === "false") return false;

  return false;
}

function formatDate(dateValue) {
  if (!dateValue) return "N/A";
  const date = new Date(dateValue);
  if (isNaN(date.getTime())) return dateValue;
  return date.toLocaleString();
}

function getFlagsArray(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.flags)) return data.flags;
  if (Array.isArray(data.data)) return data.data;
  return [];
}

function populateFlagsTable(flags) {
  flagsTableBody.innerHTML = "";

  if (!flags.length) {
    flagsTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-row">No flags available.</td>
      </tr>
    `;
    return;
  }

  const sortedFlags = [...flags].sort((a, b) =>
    getFeatureName(a).toLowerCase().localeCompare(getFeatureName(b).toLowerCase())
  );

  sortedFlags.forEach((flag) => {
    const featureName = getFeatureName(flag);
    const description = getDescription(flag) || "No description";
    const updatedAt = getUpdatedAt(flag);
    const enabled = isEnabled(flag);

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${featureName || "N/A"}</td>
      <td>
        <span class="status-badge ${enabled ? "status-on" : "status-off"}">
          ${enabled ? "Enabled" : "Disabled"}
        </span>
      </td>
      <td>${description}</td>
      <td>${formatDate(updatedAt)}</td>
      <td>
        <div class="action-buttons">
          <button
            class="btn btn-toggle toggle-btn"
            data-name="${featureName}"
            data-current="${enabled}"
            type="button"
          >
            Toggle
          </button>
          <button
            class="btn btn-delete delete-btn"
            data-name="${featureName}"
            type="button"
          >
            Delete
          </button>
        </div>
      </td>
    `;

    flagsTableBody.appendChild(row);
  });

  attachTableActionEvents();
}

function populateFlagDropdown(flags) {
  flagSelect.innerHTML = "";

  if (!flags.length) {
    flagSelect.innerHTML = `<option value="">No flags available</option>`;
    return;
  }

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "-- Select a feature flag --";
  flagSelect.appendChild(defaultOption);

  flags.forEach((flag) => {
    const featureName = getFeatureName(flag);
    const option = document.createElement("option");
    option.value = featureName;
    option.textContent = featureName;
    flagSelect.appendChild(option);
  });
}

async function fetchFlags(showAlert = false) {
  try {
    flagsTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-row">Loading flags...</td>
      </tr>
    `;

    const response = await fetch(`${API_BASE_URL}/flags`);
    const rawText = await response.text();

    console.log("GET /flags status:", response.status);
    console.log("GET /flags raw response:", rawText);

    if (showAlert) {
      alert(`GET /flags status: ${response.status}\n\nResponse:\n${rawText}`);
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch flags. Status: ${response.status}`);
    }

    const data = rawText ? JSON.parse(rawText) : [];
    availableFlags = getFlagsArray(data);

    populateFlagsTable(availableFlags);
    populateFlagDropdown(availableFlags);

    if (showAlert) {
      alert(`Flags loaded successfully.\nTotal flags: ${availableFlags.length}`);
    }
  } catch (error) {
    console.error("Error fetching flags:", error);
    flagsTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-row">Unable to load flags.</td>
      </tr>
    `;
    flagSelect.innerHTML = `<option value="">Unable to load flags</option>`;
    showFormMessage(`GET /flags failed: ${error.message}`, "error");
    alert(`GET /flags failed.\n\nError: ${error.message}`);
  }
}

async function createFlag(payload) {
  const response = await fetch(`${API_BASE_URL}/flags`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const rawText = await response.text();

  console.log("POST /flags status:", response.status);
  console.log("POST /flags raw response:", rawText);
  console.log("POST payload:", payload);

  alert(
    `POST /flags called\n\nStatus: ${response.status}\n\nPayload:\n${JSON.stringify(payload, null, 2)}\n\nResponse:\n${rawText}`
  );

  if (!response.ok) {
    throw new Error(rawText || `Failed to create flag. Status: ${response.status}`);
  }

  return rawText ? JSON.parse(rawText) : {};
}

async function deleteFlag(featureName) {
  const response = await fetch(`${API_BASE_URL}/flags/${encodeURIComponent(featureName)}`, {
    method: "DELETE"
  });

  const rawText = await response.text();

  console.log("DELETE status:", response.status, rawText);
  alert(`DELETE /flags/${featureName}\n\nStatus: ${response.status}\n\nResponse:\n${rawText}`);

  if (!response.ok) {
    throw new Error(rawText || "Failed to delete flag");
  }
}

async function toggleFlag(featureName, currentEnabled) {
  const existingFlag = availableFlags.find((flag) => getFeatureName(flag) === featureName);
  const nextEnabled = currentEnabled === "true" ? false : true;

  const payload = {
    featureName: featureName,
    enabled: nextEnabled,
    description: getDescription(existingFlag)
  };

  const response = await fetch(`${API_BASE_URL}/flags/${encodeURIComponent(featureName)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const rawText = await response.text();

  console.log("PUT status:", response.status, rawText, payload);
  alert(
    `PUT /flags/${featureName}\n\nStatus: ${response.status}\n\nPayload:\n${JSON.stringify(payload, null, 2)}\n\nResponse:\n${rawText}`
  );

  if (!response.ok) {
    throw new Error(rawText || "Failed to update flag");
  }

  return rawText ? JSON.parse(rawText) : {};
}

function attachTableActionEvents() {
  const deleteButtons = document.querySelectorAll(".delete-btn");
  const toggleButtons = document.querySelectorAll(".toggle-btn");

  deleteButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const featureName = button.dataset.name;
      const confirmed = confirm(`Delete flag "${featureName}"?`);

      if (!confirmed) return;

      try {
        await deleteFlag(featureName);
        await fetchFlags();
        showFormMessage(`Flag "${featureName}" deleted successfully.`, "success");
        alert(`Flag "${featureName}" deleted successfully.`);
      } catch (error) {
        console.error(error);
        showFormMessage(`Failed to delete flag "${featureName}": ${error.message}`, "error");
        alert(`Delete failed for "${featureName}".\n\n${error.message}`);
      }
    });
  });

  toggleButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const featureName = button.dataset.name;
      const currentEnabled = button.dataset.current;

      try {
        await toggleFlag(featureName, currentEnabled);
        await fetchFlags();
        showFormMessage(`Flag "${featureName}" toggled successfully.`, "success");
        alert(`Flag "${featureName}" toggled successfully.`);
      } catch (error) {
        console.error(error);
        showFormMessage(`Failed to toggle flag "${featureName}": ${error.message}`, "error");
        alert(`Toggle failed for "${featureName}".\n\n${error.message}`);
      }
    });
  });
}

flagForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  hideFormMessage();

  const payload = {
    featureName: document.getElementById("feature_name").value.trim(),
    enabled: document.getElementById("status").value === "Enabled",
    description: document.getElementById("description").value.trim()
  };

  if (!payload.featureName) {
    showFormMessage("Feature name is required.", "error");
    alert("Feature name is required.");
    return;
  }

  try {
    await createFlag(payload);
    flagForm.reset();
    await fetchFlags();
    showFormMessage(`Flag "${payload.featureName}" created successfully.`, "success");
    alert(`Flag "${payload.featureName}" created successfully.`);
  } catch (error) {
    console.error("Create flag error:", error);
    showFormMessage(`Failed to create flag: ${error.message}`, "error");
    alert(`Create flag failed.\n\n${error.message}`);
  }
});

refreshFlagsBtn.addEventListener("click", async () => {
  hideFormMessage();
  await fetchFlags(true);
});

reloadDemoFlagsBtn.addEventListener("click", async () => {
  await fetchFlags(true);
  demoResult.style.display = "block";
  demoResult.className = "demo-result neutral";
  demoResult.textContent = 'Dropdown reloaded. Select any available flag and click "Check Flag".';
  flagMeta.style.display = "none";
  alert("Consumer dropdown reloaded.");
});

checkFlagBtn.addEventListener("click", () => {
  const selectedFlagName = flagSelect.value;

  if (!selectedFlagName) {
    alert("Please select a flag first.");
    return;
  }

  const selectedFlag = availableFlags.find((flag) => getFeatureName(flag) === selectedFlagName);

  if (!selectedFlag) {
    alert(`Flag "${selectedFlagName}" not found in availableFlags.`);
    return;
  }

  flagMeta.style.display = "block";
  flagMeta.innerHTML = `
    <strong>Feature Name:</strong> ${getFeatureName(selectedFlag)}<br>
    <strong>Status:</strong> ${isEnabled(selectedFlag) ? "Enabled" : "Disabled"}<br>
    <strong>Description:</strong> ${getDescription(selectedFlag) || "No description available"}<br>
    <strong>Updated At:</strong> ${formatDate(getUpdatedAt(selectedFlag))}
  `;

  demoResult.style.display = "block";

  if (isEnabled(selectedFlag)) {
    demoResult.className = "demo-result on";
    demoResult.innerHTML = `
      Feature <strong>${getFeatureName(selectedFlag)}</strong> is <strong>ON</strong>.<br>
      The consumer application would enable this feature.
    `;
  } else {
    demoResult.className = "demo-result off";
    demoResult.innerHTML = `
      Feature <strong>${getFeatureName(selectedFlag)}</strong> is <strong>OFF</strong>.<br>
      The consumer application would use the fallback or default behavior.
    `;
  }

  alert(
    `Selected Flag\n\nName: ${getFeatureName(selectedFlag)}\nStatus: ${isEnabled(selectedFlag) ? "Enabled" : "Disabled"}\nDescription: ${getDescription(selectedFlag) || "No description"}`
  );
});

fetchFlags();