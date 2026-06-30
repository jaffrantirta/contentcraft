import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { identity } from "@/lib/db/schema"
import { getTokenRouterClient, DEFAULT_CHAT_MODEL } from "@/lib/tokenrouter"
import { eq } from "drizzle-orm"
import { headers } from "next/headers"

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { brief } = await req.json()
  if (!brief?.trim()) return NextResponse.json({ error: "brief is required" }, { status: 400 })

  const [identityRow] = await db.select().from(identity).where(eq(identity.userId, session.user.id)).limit(1)

  const brandContext = identityRow?.companyName
    ? `Brand: ${identityRow.companyName}${identityRow.tagline ? ` — ${identityRow.tagline}` : ""}${identityRow.website ? ` | ${identityRow.website}` : ""}`
    : ""

  const client = getTokenRouterClient({})
  const chatModel = DEFAULT_CHAT_MODEL

  const prompt = `You are a social media content specialist. Generate 5 footer text variants for a social media post carousel.

User brief: ${brief}
${brandContext ? `\n${brandContext}` : ""}

Rules:
- Each footer should be short (1-2 lines max, under 60 characters ideally)
- Include relevant info: handles, website, CTA, tagline, etc. based on the brief
- Make each variant feel different — vary tone, format, and content
- Use separator characters like · | • where natural

Return a JSON object with a "options" array of exactly 5 strings.
Respond ONLY with valid JSON, no markdown.`

  try {
    let raw: string
    try {
      const res = await client.chat.completions.create({
        model: chatModel,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      })
      raw = res.choices[0]?.message?.content || "{}"
    } catch {
      const res = await client.chat.completions.create({
        model: chatModel,
        messages: [{ role: "user", content: prompt }],
      })
      raw = res.choices[0]?.message?.content || "{}"
    }

    raw = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/^```(?:json)?\n?/im, "").replace(/\n?```$/im, "").trim()
    const parsed = JSON.parse(raw)
    const options: string[] = Array.isArray(parsed.options) ? parsed.options : Object.values(parsed)[0] as string[]

    return NextResponse.json({ options: options.slice(0, 5) })
  } catch (err) {
    console.error("[footer/generate] failed:", err instanceof Error ? err.message : err)
    return NextResponse.json({ error: "generation failed" }, { status: 500 })
  }
}
