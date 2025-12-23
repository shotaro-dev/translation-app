const chatForm = document.getElementById("chat-form");
const chatHistory = document.getElementById("chat-history");
const inputEl = document.getElementById("chat-input");
const generateImageBtn = document.getElementById("generate-image-btn");
const formTitle = document.getElementById("form-title");

let checkedRadio = null;
let checkedLang = null;
let isLoading = false;

const chatMessageClass = "font-bold py-2 px-4 rounded-b-lg  w-3/4 ";
const userMessageClass = "bg-green-400 text-black self-end rounded-tl-lg mr-4";
const assistantMessageClass =
  "bg-blue-800 text-white self-start rounded-tr-lg ml-2";

// Common function to add a message to the chat history
function appendMessage(content, isUser = false) {
  const messageEl = document.createElement("li");
  messageEl.className =
    chatMessageClass + (isUser ? userMessageClass : assistantMessageClass);
  messageEl.textContent = content;
  chatHistory.appendChild(messageEl);
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

// Show form title initially
if (formTitle) formTitle.hidden = false;

// Common API call function
async function callApi(bodyObj) {
  const res = await fetch("/api/openai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bodyObj),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "API error");
  return data;
}

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (formTitle) formTitle.hidden = true;
  const userMessage = sanitizeInput(inputEl.value.trim());
  if (!userMessage) return;

  appendMessage(userMessage, true);
  inputEl.value = "";

  // Get the selected translation language
  const checkedRadio = document.querySelector('input[name="language"]:checked');
  if (checkedRadio) {
    checkedLang = checkedRadio.value;
  }

  const messages = [
    {
      role: "system",
      content:
        "You are the world's best translator who can handle all languages. Please accurately translate the text provided by the user.",
    },
    {
      role: "user",
      content: `Please translate '${userMessage}' into ${checkedLang}. Output only the translated text.
        `,
    },
  ];

  try {
    const data = await callApi({ messages, type: "chat" });
    appendMessage(data.result, false);
  } catch (err) {
    console.error(err);
    appendMessage("An error occurred: " + err.message, false);
  }
});

async function generateImage(prompt) {
  if (formTitle) formTitle.hidden = true;
  // loading indicator
  const loadingEl = document.createElement("li");
  loadingEl.className = "w-full flex justify-center items-center py-8";
  loadingEl.innerHTML = `<span class="animate-pulse text-gray-500">Loading image...</span>`;
  chatHistory.appendChild(loadingEl);
  chatHistory.scrollTop = chatHistory.scrollHeight;

  // First, translate the prompt to English
  let translatedPrompt = prompt;
  try {
    const translationMessages = [
      {
        role: "system",
        content:
          "You are a world-class translator. Translate the user's prompt to natural English for image generation. Output only the translated prompt.",
      },
      {
        role: "user",
        content: prompt,
      },
    ];
    const data = await callApi({ messages: translationMessages, type: "chat" });
    if (data.result) {
      translatedPrompt = data.result.trim();
    }
  } catch (err) {
    console.error("Translation failed: ", err);
    translatedPrompt = prompt;
  }

  try {
    const data = await callApi({
      imagePrompt: translatedPrompt,
      type: "image",
    });
    loadingEl.remove();

    const imgEl = document.createElement("li");
    imgEl.innerHTML = `<img src="data:image/png;base64,${data.image}" class="max-w-full h-auto mx-auto pr-1" alt="generated image">`;
    chatHistory.appendChild(imgEl);
    chatHistory.scrollTop = chatHistory.scrollHeight;
    isLoading = false;
  } catch (err) {
    loadingEl.remove();
    const errorEl = document.createElement("li");
    errorEl.className = "text-red-500 text-center py-8";
    errorEl.textContent = "Failed to retrieve image";
    chatHistory.appendChild(errorEl);
    chatHistory.scrollTop = chatHistory.scrollHeight;

    console.error(err);
    isLoading = false;
  }
}

// Automatically adjust textarea height & send on Enter, newline on Shift+Enter
if (inputEl && inputEl.tagName === "TEXTAREA") {
  inputEl.addEventListener("input", function () {
    this.style.height = "auto";
    this.style.height = this.scrollHeight + "px";
  });
  inputEl.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      chatForm.requestSubmit();
    }
    // Shift+Enter defaults to newline
  });
}

generateImageBtn.addEventListener("click", () => {
  const prompt = sanitizeInput(inputEl.value.trim());
  if (!prompt || isLoading) return;
  isLoading = true;
  generateImage(prompt);
});

function sanitizeInput(input) {
  const div = document.createElement("div");
  div.textContent = input;
  return div.innerHTML;
}
