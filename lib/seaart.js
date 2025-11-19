// /lib/seaart.js
import puppeteer from "puppeteer";

export async function generateImage(prompt) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();

  await page.goto(
    "https://www.seaart.ai/create/image?id=64e43db28fb763f4e81d580ef8adb098&model_ver_no=2de33d8a77cb298a8b7b65942fb060a8",
    { waitUntil: "networkidle0" }
  );

  // ① プロンプト入力
  await page.waitForSelector("#easyGenerateInput");
  await page.type("#easyGenerateInput", prompt);

  // ② 生成ボタン
  await page.click("#generate-btn");

  // ③ 画像が出るまで待つ
  await page.waitForSelector("img.media-attachments-img-show", {
    timeout: 120000
  });

  // ④ src を取得する
  const imgUrl = await page.$eval(
    "img.media-attachments-img-show",
    (img) => img.src
  );

  await browser.close();
  return imgUrl;
}
