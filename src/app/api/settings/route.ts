import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { userSettings } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { v4 as uuidv4 } from "uuid"
import { headers } from "next/headers"

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const result = await db.query.userSettings.findFirst({ where: eq(userSettings.userId, session.user.id) })
  if (!result) return NextResponse.json({ plan: "free", freeGenerationsUsed: 0, byokApiKey: null, byokBaseUrl: null, byokModel: null })

  // mask api key
  return NextResponse.json({
    ...result,
    byokApiKey: result.byokApiKey ? `${result.byokApiKey.slice(0, 8)}...` : null,
  })
}

export async function PUT(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const body = await req.json()
  const { byokApiKey, byokBaseUrl, byokModel } = body

  const existing = await db.query.userSettings.findFirst({ where: eq(userSettings.userId, session.user.id) })

  const plan = byokApiKey ? "byok" : (existing?.plan === "pro" ? "pro" : "free")

  if (existing) {
    await db.update(userSettings).set({
      byokApiKey: byokApiKey || null,
      byokBaseUrl: byokBaseUrl || null,
      byokModel: byokModel || null,
      plan,
      updatedAt: new Date(),
    }).where(eq(userSettings.userId, session.user.id))
  } else {
    await db.insert(userSettings).values({
      id: uuidv4(),
      userId: session.user.id,
      byokApiKey: byokApiKey || null,
      byokBaseUrl: byokBaseUrl || null,
      byokModel: byokModel || null,
      plan,
    })
  }

  return NextResponse.json({ success: true, plan })
}
