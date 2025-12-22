//
import { OpenAI } from "openai";
import { GraderModels } from "openai/resources/graders/grader-models.mjs";
// import OpenAI from "https://cdn.jsdelivr.net/npm/openai@4.68.0/+esm";

// 仕様
// チャット風に表示する
// 翻訳履歴を保存する
// userは右より
// assistantは左より
// 送信ボタンを紙飛行機のアイコンにする
// Enterキーで送信できるようにする
//
// 一番下で翻訳する言語を選択する

const chatForm = document.getElementById("chat-form");
const chatHistory = document.getElementById("chat-history");
const inputEl = document.getElementById("chat-input");
const generateImageBtn = document.getElementById("generate-image-btn");

let checkedRadio = null;
let chelkedLang = null;

const chatMessageClass = "font-bold p-2  rounded-b-lg  w-11/12 ";
const userMessageClass = "bg-green-400 text-black self-end rounded-tl-lg";
const assistantMessageClass = "bg-blue-800 text-white self-start rounded-tr-lg";

const assistantMessageEl = document.createElement("div");
assistantMessageEl.className = chatMessageClass + assistantMessageClass;
assistantMessageEl.textContent =
  "Select the language you want me translate to and type your text and hit send!";
chatHistory.appendChild(assistantMessageEl);

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const userMessage = inputEl.value.trim();
  if (!userMessage) return;

  // ユーザーメッセージをチャット履歴に追加
  const userMessageEl = document.createElement("div");

  userMessageEl.className = chatMessageClass + userMessageClass;
  userMessageEl.textContent = userMessage;
  chatHistory.appendChild(userMessageEl);
  // 自動スクロール
  chatHistory.scrollTop = chatHistory.scrollHeight;
  inputEl.value = "";

  // 翻訳言語の取得
  checkedRadio = document.querySelector('input[name="language"]:checked');
  if (checkedRadio) {
    chelkedLang = checkedRadio.value;
  }

  // OpenAI APIを呼び出して翻訳を取得
  const openai = new OpenAI({
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    dangerouslyAllowBrowser: true,
  });

  const messages = [
    {
      role: "system",
      content:
        "あなたは全ての言語を操る世界一の翻訳者です。userから与えられた文章を正確に翻訳してください。",
    },
    {
      role: "user",
      content:
        userMessage +
        `を${chelkedLang}語に翻訳してください。翻訳された文章のみを出力してください。`,
    },
  ];

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: messages,
      temperature: 0.3,
      max_tokens: 500,
    });

    // アシスタントメッセージをチャット履歴に追加
    const assistantMessageEl = document.createElement("div");
    assistantMessageEl.className = chatMessageClass + assistantMessageClass;
    assistantMessageEl.textContent = response.choices[0].message.content;
    chatHistory.appendChild(assistantMessageEl);
    // 自動スクロール
    chatHistory.scrollTop = chatHistory.scrollHeight;
  } catch (err) {
    console.error(err);
  }
});

async function generateImage(prompt) {
  const openai = new OpenAI({
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    dangerouslyAllowBrowser: true,
  });

  const response = await openai.images.generate({
    // model: "dall-e-3", // default dall-e-2
    prompt: prompt, //required
    // n: 1, //default 1
    // size: "1024x1024", //default 1024x1024
    // style: "vivid", //default vivid (other option: natural)
    response_format: "b64_json", //default url (image dissappear in an hour)
  });
  console.log(response);

  chatHistory.innerHTML = `<img src="data:image/png;base64,${response.data[0].b64_json}" class="" alt="generated image">`;
}

generateImageBtn.addEventListener("click", () => {
  const prompt = inputEl.value.trim();
  if (!prompt) return;
  generateImage(prompt);
});
