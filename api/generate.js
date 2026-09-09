const OpenAI = require("openai");

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  try {
    const { info } = req.body || {};
    if (!info || !info.trim()) {
      return res.status(400).json({ error: "영상 정보를 입력하세요." });
    }

    const prompt = `당신은 YouTube Shorts 제목/해시태그 카피라이터입니다.
아래 영상 정보를 바탕으로 한국어 결과를 JSON으로만 응답하세요.

[영상 정보]
${info}

[규칙]
- titles: 서로 다른 스타일의 후킹되는 제목 5개. 각 30자 이내. 과한 낚시/허위 금지. 클릭하고 싶게.
- hashtags: 관련 해시태그 10개. "#" 포함, 공백 없이. 반드시 #Shorts 포함.
- 출력은 정확히 이 형식: {"titles": ["...", ...], "hashtags": ["#...", ...]}`;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.9,
    });

    const data = JSON.parse(completion.choices[0].message.content || "{}");
    return res.status(200).json({
      titles: Array.isArray(data.titles) ? data.titles : [],
      hashtags: Array.isArray(data.hashtags) ? data.hashtags : [],
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "생성 실패" });
  }
};
