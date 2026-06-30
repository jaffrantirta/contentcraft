import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { subscription, userSettings } from "@/lib/db/schema"
import { getCoreClient, MidtransNotification } from "@/lib/midtrans"
import { eq } from "drizzle-orm"
import { v4 as uuidv4 } from "uuid"

export async function POST(req: NextRequest) {
  const body: MidtransNotification = await req.json()

  try {
    const core = getCoreClient()
    const statusResponse = await core.transaction.notification(body)
    const orderId: string = statusResponse.order_id
    const transactionStatus: string = statusResponse.transaction_status
    const fraudStatus: string = statusResponse.fraud_status

    const [sub] = await db.select().from(subscription).where(eq(subscription.midtransOrderId, orderId)).limit(1)
    if (!sub) return NextResponse.json({ error: "subscription not found" }, { status: 404 })

    let newStatus = sub.status
    if (transactionStatus === "capture" && fraudStatus === "accept") newStatus = "active"
    else if (transactionStatus === "settlement") newStatus = "active"
    else if (["cancel", "deny", "expire"].includes(transactionStatus)) newStatus = "cancelled"
    else if (transactionStatus === "pending") newStatus = "pending"

    const now = new Date()
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // +30 days

    await db.update(subscription).set({
      status: newStatus,
      midtransTransactionId: statusResponse.transaction_id,
      periodStart: newStatus === "active" ? now : undefined,
      periodEnd: newStatus === "active" ? periodEnd : undefined,
      updatedAt: now,
    }).where(eq(subscription.midtransOrderId, orderId))

    if (newStatus === "active") {
      const [existing] = await db.select().from(userSettings).where(eq(userSettings.userId, sub.userId)).limit(1)
      if (existing) {
        await db.update(userSettings).set({ plan: "pro", updatedAt: now }).where(eq(userSettings.userId, sub.userId))
      } else {
        await db.insert(userSettings).values({ id: uuidv4(), userId: sub.userId, plan: "pro" })
      }
    }

    return NextResponse.json({ status: "ok" })
  } catch {
    return NextResponse.json({ error: "webhook processing failed" }, { status: 500 })
  }
}
