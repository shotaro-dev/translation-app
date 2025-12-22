const chatForm = document.getElementById("chat-form");
const chatHistory = document.getElementById("chat-history");
const inputEl = document.getElementById("chat-input");
const generateImageBtn = document.getElementById("generate-image-btn");

let checkedRadio = null;
let checkedLang = null;
let isLoading = false;

const chatMessageClass = "font-bold py-2 px-4 rounded-b-lg  w-11/12 ";
const userMessageClass = "bg-green-400 text-black self-end rounded-tl-lg mr-4";
const assistantMessageClass =
  "bg-blue-800 text-white self-start rounded-tr-lg ml-2";

// チャット履歴にメッセージを追加する共通関数
function appendMessage(content, isUser = false) {
  const messageEl = document.createElement("div");
  messageEl.className =
    chatMessageClass + (isUser ? userMessageClass : assistantMessageClass);
  messageEl.textContent = content;
  chatHistory.appendChild(messageEl);
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

// 初期メッセージ
appendMessage(
  "Select the language you want me translate to and type your text and hit send!",
  false
);

// 共通のAPI呼び出し関数
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
  const userMessage = inputEl.value.trim();
  if (!userMessage) return;

  appendMessage(userMessage, true);
  inputEl.value = "";

  // 翻訳言語の取得
  const checkedRadio = document.querySelector('input[name="language"]:checked');
  if (checkedRadio) {
    checkedLang = checkedRadio.value; // Corrected variable name
  }

  const messages = [
    {
      role: "system",
      content:
        "あなたは全ての言語を操る世界一の翻訳者です。userから与えられた文章を正確に翻訳してください。",
    },
    {
      role: "user",
      content: `${userMessage}を${checkedLang}語に翻訳してください。翻訳された文章のみを出力してください。`,
    },
  ];

  try {
    const data = await callApi({ messages, type: "chat" });
    appendMessage(data.result, false);
  } catch (err) {
    console.error(err);
    appendMessage("エラーが発生しました: " + err.message, false);
  }
});

async function generateImage(prompt) {
  // ローディング表示
  chatHistory.innerHTML =
    '<div class="w-full flex justify-center items-center py-8"><span class="animate-pulse text-gray-500">Loading image...</span></div>';

  // まずプロンプトを英語に翻訳
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
    console.error("翻訳失敗: ", err);
    translatedPrompt = prompt;
  }

  try {
    const data = await callApi({
      imagePrompt: translatedPrompt,
      type: "image",
    });
    chatHistory.innerHTML = `<img src="data:image/png;base64,${data.image}" class="max-w-full h-auto mx-auto" alt="generated image">`;
    isLoading = false;
  } catch (err) {
    chatHistory.innerHTML =
      '<div class="text-red-500 text-center py-8">画像の取得に失敗しました</div>';
    console.error(err);
    isLoading = false;
  }
}

// textareaの高さを自動調整 & Enterで送信、Shift+Enterで改行
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
    // Shift+Enterはデフォルトで改行
  });
}

generateImageBtn.addEventListener("click", () => {
  const prompt = inputEl.value.trim();
  if (!prompt || isLoading) return;
  isLoading = true;
  generateImage(prompt);
});
