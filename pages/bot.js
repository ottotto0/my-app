const puppeteer = require("puppeteer");
const fs = require("fs");
const https = require("https");

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: "/usr/bin/google-chrome",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage"
    ]
  });

  const page = await browser.newPage();

  await page.goto("https://www.seaart.ai/create/image?id=64e43db28fb763f4e81d580ef8adb098&model_ver_no=2de33d8a77cb298a8b7b65942fb060a8", {
    waitUntil: "networkidle2"
  });

  await page.type("#easyGenerateInput", "A cat riding a rocket, anime style");
  await page.click("#generate-btn");

  await page.waitForSelector("img.media-attachments-img-show", { timeout: 120000 });

  const imgUrl = await page.$eval("img.media-attachments-img-show", el => el.src);
  console.log("生成画像URL:", imgUrl);

  https.get(imgUrl, (res) => {
    const file = fs.createWriteStream("result.webp");
    res.pipe(file);
    file.on("finish", () => {
      file.close();
      console.log("保存: result.webp");
    });
  });

  await browser.close();
})();
