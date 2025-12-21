//
import { OpenAI } from "openai";
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


const translateForm = document.getElementById("translation-form");
const outputEl = document.getElementById("output-text");
const inputEl = document.getElementById("input-text");

let checkedRadio = null;
let chelkedLang = null;

inputEl.addEventListener("input", () => {});

translateForm.addEventListener("submit", (e) => {
  e.preventDefault();
  translateForm.querySelector("button").disabled = true;
  translateForm.querySelector("button").textContent = "Translating...";
  outputEl.textContent = "";
  checkedRadio = document.querySelector('input[name="language"]:checked');
  if (checkedRadio) {
    chelkedLang = checkedRadio.value;
  }
  translate();
});

async function translate() {
  try {
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
          inputEl.value.trim() +
          `を${chelkedLang}語に翻訳してください。翻訳された文章のみを出力してください。`,
      },
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: messages,
      temperature: 0.3,
      max_tokens: 500,
    });
      console.log(response)

      // responce.okは存在しないためコメントアウト
    // if (!response.ok) {
    //   throw new Error("Request failed");
    // }
    outputEl.textContent = response.choices[0].message.content;
    console.log(response);
  } catch (err) {
    outputEl.textContent = "Error: " + err.message;
    console.error(err);
  } finally {
    translateForm.querySelector("button").disabled = false;
    translateForm.querySelector("button").textContent = "Translate";
  }
}
