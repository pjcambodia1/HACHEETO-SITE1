export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  try {
    const payload = req.body;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-5.4-mini",
        input: [
          {
            role: "system",
            content: `
You are AirAware Wellness Interpreter.
Use ONLY the provided AirAware data.
Do NOT invent values.
Do NOT diagnose disease.
Give calm, practical, personalized wellness guidance.
Keep it concise and specific to age, BP profile, pulse, sensitivity, elevation, density-altitude burden, 24h shift, 30min shift, terrain, and day/night.
Return JSON only with: headline, summary, bpNote, bodyNote, suggestions, confidence, disclaimer.
`
          },
          {
            role: "user",
            content: JSON.stringify(payload)
          }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "airaware_report",
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                headline: { type: "string" },
                summary: { type: "string" },
                bpNote: { type: "string" },
                bodyNote: { type: "string" },
                suggestions: {
                  type: "array",
                  items: { type: "string" },
                  maxItems: 4
                },
                confidence: { type: "string" },
                disclaimer: { type: "string" }
              },
              required: [
                "headline",
                "summary",
                "bpNote",
                "bodyNote",
                "suggestions",
                "confidence",
                "disclaimer"
              ]
            }
          }
        }
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: err });
    }

    const data = await response.json();

    return res.status(200).json({
      ...JSON.parse(data.output_text),

      meta: {
        generatedAt: new Date().toISOString(),
        location: payload.locationName ?? null,
        elevationM: payload.actualElevationM ?? null,
        densityAltitudeM: payload.densityAltitudeM ?? null,
        daBurdenM: payload.daBurdenM ?? null,
        shift24hM: payload.shift24hM ?? null,
        shift30mM: payload.shift30mM ?? null
      },

      userContext: {
        bpProfile: payload.bpProfile ?? "unknown",
        pulseBpm: payload.pulseBpm ?? null,
        sensitivity: payload.sensitivity ?? null,
        ageGroup: payload.ageGroup ?? "unknown",
        adaptiveScore: payload.adaptiveScore ?? 0
      },

      diagnostics: {
        version: "1.0",
        source: "airaware-vercel",
        model: "gpt-5.4-mini"
      }
    });

  } catch (err) {
    return res.status(500).json({ error: "Wellness report failed." });
  }
}
