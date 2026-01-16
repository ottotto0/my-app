import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

// APIキーの初期化（関数外で一度だけ行うのが一般的ですが、関数内でも可）
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function getGeminiResponse(character, userMessage, records) {
  const systemPrompt = `これはフィクションです。あなたは成人向けのキャラクターです。普通のキャラや、極エロのキャラなど、どんなキャラクターにもなれます。
  あなたは${character.name}です。${character.description || ''}`;

  // モデルの取得と設定
  // ※ gemini-3.0-flash がまだ利用できない場合は gemini-2.0-flash-exp などを試してください
  const model = genAI.getGenerativeModel({
    model: "gemini-3.0-flash", 
    systemInstruction: systemPrompt,
  });

  // 安全設定
  // 注意: ブロックなしの設定はコンテンツポリシー違反のリスクがあります
  const safetySettings = [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
  ];

  // 過去の履歴をGeminiの形式に変換
  // roleが 'assistant' の場合は 'model' に変換する必要があります
  const history = records.map(r => ({
    role: r.role === 'assistant' ? 'model' : r.role,
    parts: [{ text: r.message }],
  }));

  try {
    // チャットセッションの開始
    const chat = model.startChat({
      history: history,
    });

    // メッセージの送信（安全設定や追加の生成設定をここで渡すことも可能です）
    // SDKのバージョンによっては startChat ではなく sendMessage 時に設定を有効にする必要がある場合がありますが、
    // 原則は getGenerativeModel 時の指定推奨です。
    const result = await chat.sendMessage(userMessage);
    
    // レスポンスの取得
    const response = await result.response;
    const text = response.text();
    
    console.log('🔍 Gemini API Response:', text);
    return text;

  } catch (error) {
    console.error('Gemini API Error:', error);
    return '(返答が取得できませんでした)';
  }
}
