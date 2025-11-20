const express = require("express");
const puppeteer = require("puppeteer");
const app = express();

app.use(express.json());
app.use(express.static("./")); // index.html を公開

app.post("/generate", async (req, res) => {
  const prompt = req.body.prompt;

  // SeaArt の指定URL（このページを操作）
  const targetURL = "https://www.seaart.ai/ja/create/image?id=24231feb2db47b663ff5b3123f01fab6&model_ver_no=6e2e976db9a8e83312a0c91b852f876c";

  // Puppeteer 起動
  const browser = await puppeteer.launch({
    headless: false, // 画面表示を見る場合 false
    args: ["--no-sandbox"]
  });

  const page = await browser.newPage();
  await page.goto(targetURL, { waitUntil: "networkidle2" });

  // ⭐ SeaArt のプロンプト入力UIを特定して入力
  await page.waitForSelector("textarea");
  await page.evaluate((text) => {
    document.querySelector("textarea").value = text;
  }, prompt);

  // 生成ボタンを押す（※実際のボタン位置によって要調整）
  await page.click("button:contains('生成')").catch(async () => {
    const buttons = await page.$$("button");
    for (const b of buttons) {
      const text = await (await b.getProperty("innerText")).jsonValue();
      if (text && text.includes("生成")) {
        await b.click();
        break;
      }
    }
  });

  // 画像が生成されるまで待つ
  await page.waitForSelector("img", { timeout: 60000 });

  // 生成画像 src を取得（例：<img src="https://...">）
  const imageURL = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll("img"));
    const art = imgs.find(i => i.src.includes("https"));
    return art ? art.src : null;
  });

  await browser.close();
  res.json({ image: imageURL });
});

app.listen(3000, () => console.log("http://localhost:3000 へアクセス"));
