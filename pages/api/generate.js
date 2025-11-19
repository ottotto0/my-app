import puppeteer from "puppeteer";

export default async function handler(req, res) {
  const { prompt } = req.body;

  if (!prompt) return res.status(400).json({ error: "No prompt" });

  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.goto("https://www.seaart.ai/create");

    await page.waitForSelector("#easyGenerateInput");
    await page.type("#easyGenerateInput", prompt);

    await page.click("#generate-btn");

    await page.waitForSelector("img.media-attachments-img-show", { timeout: 60000 });

    const imageURL = await page.$eval(
      "img.media-attachments-img-show",
      (el) => el.src
    );

    await browser.close();
    return res.status(200).json({ imageURL });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to generate" });
  }
}
