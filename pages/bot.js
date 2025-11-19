import { useState } from "react";

export default function BotPage() {
  const [prompt, setPrompt] = useState("");
  const [image, setImage] = useState("");

  const generate = async () => {
    const res = await fetch("../api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });

    const data = await res.json();
    if (data.imageURL) setImage(data.imageURL);
  };

  return (
    <div>
      <h1>AI Image Bot</h1>
      <textarea onChange={(e) => setPrompt(e.target.value)} />
      <button onClick={generate}>Generate</button>
      {image && <img src={image} />}
    </div>
  );
}
