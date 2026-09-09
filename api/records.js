const { neon } = require("@neondatabase/serverless");

const sql = neon(process.env.DATABASE_URL);

module.exports = async (req, res) => {
  try {
    if (req.method === "GET") {
      const rows = await sql`
        select id, video_info, chosen_title, chosen_hashtags, created_at
        from clip_records
        order by created_at desc
        limit 20`;
      return res.status(200).json({ records: rows });
    }

    if (req.method === "POST") {
      const { info, title, hashtags } = req.body || {};
      if (!info || !title) {
        return res.status(400).json({ error: "info, title은 필수입니다." });
      }
      const tags = Array.isArray(hashtags) ? hashtags.join(" ") : hashtags || "";
      const rows = await sql`
        insert into clip_records (video_info, chosen_title, chosen_hashtags)
        values (${info}, ${title}, ${tags})
        returning id, video_info, chosen_title, chosen_hashtags, created_at`;
      return res.status(200).json({ record: rows[0] });
    }

    return res.status(405).json({ error: "GET/POST only" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "DB 오류" });
  }
};
