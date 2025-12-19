const inputEl = document.getElementById("input-text");
const outputEl = document.getElementById("output-text");
const btn = document.getElementById("translate-button");
const langSelect = document.getElementById("language-select");

async function translate(text, target) {
  if (!text) return "";
  const res = await fetch("/api/openai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, target }),
  });
  if (!res.ok) {
    const textErr = await res.text();
    throw new Error(textErr || "Request failed");
  }
  const data = await res.json();
  return data.translation || data.output || "";
}

btn.addEventListener("click", async () => {
  btn.disabled = true;
  btn.textContent = "Translating...";
  outputEl.textContent = "";
  try {
    const text = inputEl.value.trim();
    const target = langSelect.value || "es";
    const translation = await translate(text, target);
    outputEl.textContent = translation;
  } catch (err) {
    outputEl.textContent = "Error: " + err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = "Translate";
  }
});

// Allow Enter+Ctrl to submit in textarea
inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
    btn.click();
  }
});

export {};
