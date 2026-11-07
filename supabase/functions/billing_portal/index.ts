// Opens the Stripe customer portal so subscribers can change card or cancel.
import { cors, customerFor, json, stripe, userFrom } from '../_shared.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const user = await userFrom(req)
    const { returnUrl } = await req.json()
    const customer = await customerFor(user.id, user.email)
    const portal = await stripe.billingPortal.sessions.create({ customer, return_url: returnUrl })
    return json({ url: portal.url })
  } catch (e) {
    return json({ error: (e as Error).message }, 400)
  }
})
