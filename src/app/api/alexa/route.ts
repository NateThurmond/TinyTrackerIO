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

  const babyId = ALEXA_BABY_ID
  const userId = ALEXA_USER_ID

  if (!babyId || !userId) {
    return alexaResponse("Tiny Tracker isn't configured yet. Please contact your app admin.")
  }

  // ── LogPee ───────────────────────────────────────────
  if (intentName === 'LogPee') {
    const size = normalizeDiaperSize(slots.Size?.value)
    await supabaseAdmin.from('diapers').insert({ baby_id: babyId, logged_by: userId, type: 'pee', size })
    return alexaResponse('Got it, pee logged!')
  }

  // ── LogPoop ──────────────────────────────────────────
  if (intentName === 'LogPoop') {
    const size = normalizeDiaperSize(slots.Size?.value)
    const sizeWord = size === 'med' ? '' : ` ${size}`
    await supabaseAdmin.from('diapers').insert({ baby_id: babyId, logged_by: userId, type: 'poop', size })
    return alexaResponse(`Got it,${sizeWord} poop logged!`)
  }

  // ── LogMixedDiaper ───────────────────────────────────
  if (intentName === 'LogMixedDiaper') {
    await supabaseAdmin.from('diapers').insert({ baby_id: babyId, logged_by: userId, type: 'mixed', size: 'med' })
    return alexaResponse('Mixed diaper logged!')
  }

  // ── LogFeeding ───────────────────────────────────────
  if (intentName === 'LogFeeding') {
    const rawAmount = slots.Amount?.value ? parseFloat(slots.Amount.value) : null
    if (!rawAmount || isNaN(rawAmount)) {
      return alexaResponse('How much? Try saying: log 4 ounces or log 120 milliliters.', false)
    }
    const unitRaw: string = slots.Unit?.value ?? 'ml'
    const isOz = unitRaw.toLowerCase().includes('oz') || unitRaw.toLowerCase().includes('ounce')
    const amountMl = isOz ? ozToMl(rawAmount) : Math.round(rawAmount)
    await supabaseAdmin.from('feedings').insert({ baby_id: babyId, logged_by: userId, amount_ml: amountMl })
    return alexaResponse(`Done! Logged ${rawAmount} ${isOz ? 'ounces' : 'milliliters'}.`)
  }

  // ── StartSleep ───────────────────────────────────────
  if (intentName === 'StartSleep') {
    await supabaseAdmin.from('sleeps').insert({ baby_id: babyId, logged_by: userId })
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

  return alexaResponse("I didn't understand that command.")
}
