// Optional cloud layer: accounts, cloud saves and the $5 a month subscription.
// Without VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY the app runs fully in local mode.
import { createClient, Session, SupabaseClient } from '@supabase/supabase-js'
import { Play } from './model'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const cloudEnabled = !!(url && key)
export const supabase: SupabaseClient | null = cloudEnabled ? createClient(url!, key!) : null

export type Plan = 'free' | 'pro'

export const PLAN_LIMITS = {
  free: { savedPlays: 3, watermark: true, cloud: false },
  pro: { savedPlays: Infinity, watermark: false, cloud: true },
}

export const PRICE_TEXT = '$5 / month'

export interface Account {
  session: Session | null
  email: string | null
  plan: Plan
  status: string
}

export async function getAccount(): Promise<Account> {
  if (!supabase) return { session: null, email: null, plan: 'pro', status: 'local' }
  const { data } = await supabase.auth.getSession()
  const session = data.session
  if (!session) return { session: null, email: null, plan: 'free', status: 'signed out' }
  const { data: profile } = await supabase.from('profiles').select('plan, subscription_status').eq('id', session.user.id).maybeSingle()
  const active = profile?.subscription_status === 'active' || profile?.subscription_status === 'trialing'
  return {
    session,
    email: session.user.email ?? null,
    plan: profile?.plan === 'pro' && active ? 'pro' : 'free',
    status: profile?.subscription_status ?? 'none',
  }
}

export function onAuthChange(cb: () => void) {
  if (!supabase) return () => {}
  const { data } = supabase.auth.onAuthStateChange(() => cb())
  return () => data.subscription.unsubscribe()
}

export async function signInWithEmail(email: string) {
  if (!supabase) throw new Error('Accounts are not set up on this site.')
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } })
  if (error) throw error
}

export async function signOut() {
  await supabase?.auth.signOut()
}

export async function listCloudPlays(): Promise<Play[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from('plays').select('data').order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((r) => r.data as Play)
}

export async function saveCloudPlay(play: Play) {
  if (!supabase) return
  const { data: u } = await supabase.auth.getUser()
  if (!u.user) throw new Error('Sign in to save to the cloud.')
  const { error } = await supabase.from('plays').upsert({
    id: play.id,
    owner: u.user.id,
    name: play.name,
    data: play,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}

export async function deleteCloudPlay(id: string) {
  if (!supabase) return
  const { error } = await supabase.from('plays').delete().eq('id', id)
  if (error) throw error
}

export async function startCheckout() {
  if (!supabase) throw new Error('Payments are not set up on this site.')
  const { data, error } = await supabase.functions.invoke('create_checkout', { body: { returnUrl: location.origin + location.pathname } })
  if (error) throw error
  location.href = data.url
}

export async function openBillingPortal() {
  if (!supabase) return
  const { data, error } = await supabase.functions.invoke('billing_portal', { body: { returnUrl: location.origin + location.pathname } })
  if (error) throw error
  location.href = data.url
}
