// Starts a Stripe Checkout session for the Coach plan ($5 a month).
import { cors, customerFor, json, stripe, userFrom } from '../_shared.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const user = await userFrom(req)
    const { returnUrl } = await req.json()
    const customer = await customerFor(user.id, user.email)
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer,
      line_items: [{ price: Deno.env.get('STRIPE_PRICE_ID')!, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${returnUrl}?upgraded=1`,
      cancel_url: returnUrl,
      client_reference_id: user.id,
      subscription_data: { metadata: { user_id: user.id } },
    })
    return json({ url: session.url })
  } catch (e) {
    return json({ error: (e as Error).message }, 400)
  }
})
