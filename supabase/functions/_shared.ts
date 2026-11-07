import Stripe from 'npm:stripe@17.7.0'
import { createClient } from 'npm:@supabase/supabase-js@2.119.0'

export const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2025-02-24.acacia' })

export const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

/** Returns the signed in user from the request's Authorization header. */
export async function userFrom(req: Request) {
  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) throw new Error('Not signed in')
  return data.user
}

/** Finds or creates the Stripe customer for a user. */
export async function customerFor(userId: string, email: string | undefined) {
  const { data: profile } = await admin.from('profiles').select('stripe_customer_id').eq('id', userId).maybeSingle()
  if (profile?.stripe_customer_id) return profile.stripe_customer_id as string
  const customer = await stripe.customers.create({ email, metadata: { user_id: userId } })
  await admin.from('profiles').upsert({ id: userId, email, stripe_customer_id: customer.id })
  return customer.id
}
