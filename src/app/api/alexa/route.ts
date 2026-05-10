import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { ozToMl } from '@/lib/utils'

// Alexa Custom Skill endpoint — handles real Alexa Skills Kit (ASK) request format
// Amazon POSTs JSON here; we verify the skill ID and return ASK response format.

const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Logged-in Supabase user ID + baby ID used for all Alexa-logged events
const ALEXA_USER_ID = process.env.ALEXA_USER_ID!
const ALEXA_BABY_ID = process.env.ALEXA_BABY_ID!
const SKILL_ID = process.env.ALEXA_SKILL_ID!

async function notifyVillage(babyId: string, loggedByUserId: string, title: string, body: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tinytrackerio.nathanthurmond.com'
    await fetch(`${baseUrl}/api/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ babyId, loggedByUserId, title, body }),
    })
  } catch { /* non-critical */ }
}

function alexaResponse(text: string, endSession = true) {
  return NextResponse.json({
    version: '1.0',
    response: {
      outputSpeech: { type: 'PlainText', text },
      shouldEndSession: endSession,
    },
  })
}

function normalizeDiaperSize(raw: string | undefined): 'small' | 'med' | 'big' | 'ginormous' {
  if (!raw) return 'med'
  const lower = raw.toLowerCase()
  if (lower.includes('gin') || lower.includes('huge') || lower.includes('enormous')) return 'ginormous'
  if (lower.includes('big') || lower.includes('large')) return 'big'
  if (lower.includes('small') || lower.includes('little') || lower.includes('tiny')) return 'small'
  return 'med'
}

function parseSpokenNumber(raw: string | undefined): number | null {
  if (!raw) return null
  const cleaned = raw.trim().toLowerCase()

  const numeric = cleaned.match(/\d+(?:\.\d+)?/)
  if (numeric) return parseFloat(numeric[0])

  const simpleMap: Record<string, number> = {
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
    sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
  }

  if (cleaned in simpleMap) return simpleMap[cleaned]

  // Handle phrases like "four and a half" or "three point five"
  const halfMatch = cleaned.match(/(one|two|three|four|five|six|seven|eight|nine|ten)\s+and\s+a\s+half/)
  if (halfMatch) return (simpleMap[halfMatch[1]] ?? 0) + 0.5

  if (cleaned.includes('point')) {
    const parts = cleaned.split('point').map((p) => p.trim())
    const whole = simpleMap[parts[0]]
    const fracWord = parts[1]
    if (whole != null && fracWord in simpleMap) {
      const frac = simpleMap[fracWord]
      const digits = String(frac)
      return parseFloat(`${whole}.${digits}`)
    }
  }

  return null
}

function normalizeUnit(rawUnit: string | undefined, rawAmount: string | undefined): 'oz' | 'ml' {
  const joined = `${rawUnit ?? ''} ${rawAmount ?? ''}`.toLowerCase()
  if (joined.includes('oz') || joined.includes('ounce') || joined.includes('bottle')) return 'oz'
  if (joined.includes('ml') || joined.includes('milliliter') || joined.includes('millilitre')) return 'ml'
  return 'ml'
}

function extractFeeding(slots: Record<string, { value?: string }>) {
  const rawAmount = slots.Amount?.value
  const amount = parseSpokenNumber(rawAmount) ?? (rawAmount ? parseFloat(rawAmount) : null)
  if (!amount || isNaN(amount) || amount <= 0) return null
  const unit = normalizeUnit(slots.Unit?.value, rawAmount)
  const amountMl = unit === 'oz' ? ozToMl(amount) : Math.round(amount)
  return { amount, unit, amountMl }
}

export async function POST(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Verify this request is from our skill
  const applicationId = body?.context?.System?.application?.applicationId
  if (SKILL_ID && applicationId !== SKILL_ID) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const requestType: string = body?.request?.type

  // Handle launch + session ended
  if (requestType === 'LaunchRequest') {
    return alexaResponse('Tiny Tracker ready. You can say: log a pee, log a poop, or log a feeding.')
  }
  if (requestType === 'SessionEndedRequest') {
    return NextResponse.json({ version: '1.0', response: {} })
  }

  if (requestType !== 'IntentRequest') {
    return alexaResponse("I didn't understand that.")
  }

  const intentName: string = body?.request?.intent?.name
  const slots = body?.request?.intent?.slots ?? {}

  // Built-in stop/cancel
  if (intentName === 'AMAZON.StopIntent' || intentName === 'AMAZON.CancelIntent') {
    return alexaResponse('Okay, bye!')
  }
  if (intentName === 'AMAZON.HelpIntent') {
    return alexaResponse('You can say: log a pee, log a poop, log a big poop, log a mixed diaper, or log 4 ounces.')
  }
  if (intentName === 'AMAZON.FallbackIntent') {
    return alexaResponse('Do you want to log a pee, poop, or feeding? For feeding, say log 4 ounces or log 120 milliliters.', false)
  }

  const babyId = ALEXA_BABY_ID
  const userId = ALEXA_USER_ID

  if (!babyId || !userId) {
    return alexaResponse("Tiny Tracker isn't configured yet. Please contact your app admin.")
  }

  // ── LogPee ───────────────────────────────────────────
  if (intentName === 'LogPee') {
    const size = normalizeDiaperSize(slots.Size?.value)
    await supabaseAdmin.from('diapers').insert({ baby_id: babyId, logged_by: userId, type: 'pee', size })
    notifyVillage(babyId, userId, '💧 Pee logged', `Alexa logged a pee diaper for Benjamin`)
    return alexaResponse('Got it, pee logged!')
  }

  // ── LogPoop ──────────────────────────────────────────
  if (intentName === 'LogPoop') {
    // If Alexa routed a feeding-like phrase here, ask for clarification instead of logging poop.
    const slotValues = Object.values(slots as Record<string, { value?: string }>)
      .map((s) => s?.value ?? '')
      .join(' ')
      .toLowerCase()
    if (slotValues.includes('ounce') || slotValues.includes('oz') || slotValues.includes('ml') || slotValues.includes('bottle') || slotValues.includes('formula') || slotValues.includes('feed')) {
      return alexaResponse('I heard a feeding amount. Say: log 4 ounces, or log 120 milliliters.', false)
    }

    const size = normalizeDiaperSize(slots.Size?.value)
    const sizeWord = size === 'med' ? '' : ` ${size}`
    await supabaseAdmin.from('diapers').insert({ baby_id: babyId, logged_by: userId, type: 'poop', size })
    notifyVillage(babyId, userId, '💩 Poop logged', `Alexa logged a${sizeWord} poop diaper for Benjamin`)
    return alexaResponse(`Got it,${sizeWord} poop logged!`)
  }

  // ── LogMixedDiaper ───────────────────────────────────
  if (intentName === 'LogMixedDiaper') {
    await supabaseAdmin.from('diapers').insert({ baby_id: babyId, logged_by: userId, type: 'mixed', size: 'med' })
    notifyVillage(babyId, userId, '💩💧 Mixed diaper logged', `Alexa logged a mixed diaper for Benjamin`)
    return alexaResponse('Mixed diaper logged!')
  }

  // ── LogFeeding ───────────────────────────────────────
  if (intentName === 'LogFeeding' || intentName === 'LogBottle' || intentName === 'LogFormula') {
    const feeding = extractFeeding(slots)
    if (!feeding) {
      return alexaResponse('How much? Try saying: log 4 ounces or log 120 milliliters.', false)
    }
    await supabaseAdmin.from('feedings').insert({ baby_id: babyId, logged_by: userId, amount_ml: feeding.amountMl })
    notifyVillage(babyId, userId, '🍼 Feeding logged', `Alexa logged ${feeding.amount} ${feeding.unit} for Benjamin`)
    return alexaResponse(`Done! Logged ${feeding.amount} ${feeding.unit === 'oz' ? 'ounces' : 'milliliters'}.`)
  }

  // ── StartSleep ───────────────────────────────────────
  if (intentName === 'StartSleep') {
    await supabaseAdmin.from('sleeps').insert({ baby_id: babyId, logged_by: userId })
    notifyVillage(babyId, userId, '😴 Sleep started', 'Alexa logged Benjamin is sleeping')
    return alexaResponse('Sleep started. Sweet dreams!')
  }

  // ── EndSleep ─────────────────────────────────────────
  if (intentName === 'EndSleep') {
    const { data: activeSleep } = await supabaseAdmin
      .from('sleeps')
      .select('id')
      .eq('baby_id', babyId)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .single()

    if (!activeSleep) {
      return alexaResponse("I didn't find an active sleep session to end.")
    }
    await supabaseAdmin.from('sleeps').update({ ended_at: new Date().toISOString() }).eq('id', activeSleep.id)
    return alexaResponse('Sleep ended. Good morning!')
  }

  return alexaResponse('I did not catch that. Say: log a pee, log a poop, or log 4 ounces.', false)
}
