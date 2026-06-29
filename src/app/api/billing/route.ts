import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { subscription } from "@/lib/db/schema"
import { getSnapClient, PRO_PRICE_IDR } from "@/lib/midtrans"
import { v4 as uuidv4 } from "uuid"
import { headers } from "next/headers"

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { planName = "pro" } = await req.json()
  const orderId = `CC-${uuidv4().slice(0, 8).toUpperCase()}`
  const amount = PRO_PRICE_IDR

  const snap = getSnapClient()
  const parameter = {
    transaction_details: { order_id: orderId, gross_amount: amount },
    customer_details: {
      first_name: session.user.name,
      email: session.user.email,
    },
    item_details: [{
      id: planName,
      price: amount,
      quantity: 1,
      name: "ContentCraft Pro — 1 Month",
    }],
  }

  const transaction = await snap.createTransaction(parameter)

  await db.insert(subscription).values({
    id: uuidv4(),
    userId: session.user.id,
    midtransOrderId: orderId,
    status: "pending",
    planName,
    amount,
    currency: "IDR",
  })

  return NextResponse.json({ token: transaction.token, redirect_url: transaction.redirect_url, orderId })
}
