// eslint-disable-next-line @typescript-eslint/no-require-imports
const midtransClient = require("midtrans-client")

export const PRO_PRICE_IDR = 99000

export function getSnapClient() {
  return new midtransClient.Snap({
    isProduction: process.env.MIDTRANS_IS_PRODUCTION === "true",
    serverKey: process.env.MIDTRANS_SERVER_KEY,
    clientKey: process.env.MIDTRANS_CLIENT_KEY,
  })
}

export function getCoreClient() {
  return new midtransClient.CoreApi({
    isProduction: process.env.MIDTRANS_IS_PRODUCTION === "true",
    serverKey: process.env.MIDTRANS_SERVER_KEY,
    clientKey: process.env.MIDTRANS_CLIENT_KEY,
  })
}

export interface MidtransNotification {
  order_id: string
  transaction_status: string
  fraud_status?: string
  transaction_id: string
  payment_type: string
  gross_amount: string
}
