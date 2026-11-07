// Keeps each profile's plan in sync with Stripe. Deploy with --no-verify-jwt.
import Stripe from 'npm:stripe@17.7.0'
import { admin, stripe } from '../_shared.ts'

const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!

async function sync(sub: Stripe.Subscription) {
  const customer = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
  const active = sub.status === 'active' || sub.status === 'trialing'
  await admin
    .from('profiles')
    .update({
      plan: active ? 'pro' : 'free',
      subscription_status: sub.status,
      stripe_subscription_id: sub.id,
      current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
    })
    .eq('stripe_customer_id', customer)
}

Deno.serve(async (req) => {
  const signature = req.headers.get('Stripe-Signature') ?? ''
  const body = await req.text()
  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, secret)
  } catch (e) {
    return new Response(`Bad signature: ${(e as Error).message}`, { status: 400 })
  }
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await sync(event.data.object as Stripe.Subscription)
      break
    case 'checkout.session.completed': {
      const s = event.data.object as Stripe.Checkout.Session
      if (s.subscription) await sync(await stripe.subscriptions.retrieve(s.subscription as string))
      break
    }
  }
  return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } })
})
