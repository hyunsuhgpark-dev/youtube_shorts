const OpenAI = require("openai");
const { YoutubeTranscript } = require("youtube-transcript");

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function extractVideoId(url) {
  if (!url) return null;
  const patterns = [
    /youtube\.com\/shorts\/([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
    /youtube\.com\/watch\?v=([\w-]{11})/,
    /youtube\.com\/embed\/([\w-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  if (/^[\w-]{11}$/.test(url.trim())) return url.trim();
  return null;
}

function decodeEntities(s) {
  return String(s)
    .replace(/&amp;#39;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

async function fetchOembed(videoId) {
  try {
    const u =
      "https://www.youtube.com/oembed?format=json&url=" +
      encodeURIComponent("https://www.youtube.com/watch?v=" + videoId);
    const r = await fetch(u);
    if (!r.ok) return {};
    const j = await r.json();
    return { title: j.title || "", author: j.author_name || "" };
  } catch {
    return {};
  }
}

async function fetchTranscript(videoId) {
  try {
    const items = await YoutubeTranscript.fetchTranscript(videoId);
    return decodeEntities(items.map((i) => i.text).join(" ")).trim();
  } catch {
    return "";
  }
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  try {
    const { url, manualText } = req.body || {};
    const videoId = extractVideoId(url);
    const manual = (manualText || "").trim();

    if (!videoId && !manual) {
      return res.status(400).json({
        error: "유효한 YouTube URL을 입력하거나, 직접 붙여넣기 칸에 내용을 적어주세요.",
      });
    }

    let title = "";
    let author = "";
    let transcript = "";
    if (videoId) {
      const [oembed, tr] = await Promise.all([
        fetchOembed(videoId),
        fetchTranscript(videoId),
      ]);
      title = oembed.title || "";
      author = oembed.author || "";
      transcript = tr;
    }

    if (!title && !transcript && !manual) {
      return res.status(422).json({
        error:
          "영상 제목과 자막을 모두 가져오지 못했습니다. '직접 붙여넣기' 칸에 영상 내용을 적어 다시 시도하세요.",
      });
    }

    const context = [
      title ? `영상 제목: ${title}` : "",
      author ? `채널: ${author}` : "",
      transcript ? `자막(대사):\n${transcript.slice(0, 4000)}` : "",
      manual ? `추가 설명(사용자 입력):\n${manual}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const prompt = `당신은 YouTube Shorts 카피라이터입니다.
아래 영상 자료를 분석해서 한국어로 JSON만 응답하세요.

${context}

[규칙]
- keywords: 영상의 핵심 키워드 6~10개 (짧은 단어/구, # 없이).
- titles: 서로 다른 스타일의 후킹되는 제목 5개. 각 30자 이내. 낚시/허위 금지. 클릭하고 싶게.
- hashtags: 관련 해시태그 10개. "#" 포함, 공백 없이, 반드시 #Shorts 포함.
- 정확히 이 형식: {"keywords":["..."],"titles":["..."],"hashtags":["#..."]}`;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.8,
    });

    const data = JSON.parse(completion.choices[0].message.content || "{}");
    return res.status(200).json({
      source: { videoId, title, author, hasTranscript: !!transcript },
      keywords: Array.isArray(data.keywords) ? data.keywords : [],
      titles: Array.isArray(data.titles) ? data.titles : [],
      hashtags: Array.isArray(data.hashtags) ? data.hashtags : [],
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "생성 실패" });
  }
};
