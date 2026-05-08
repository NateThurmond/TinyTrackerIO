import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { ozToMl } from '@/lib/utils'

// Alexa Smart Home / Custom Skill webhook
// Alexa Lambda calls: POST /api/alexa with JSON body
// Expected body: { userId: string, intent: string, slots?: Record<string, string> }
// userId here is the Supabase user ID stored in Alexa account linking

const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface AlexaRequest {
  userId: string
  intent: string
  slots?: {
    diaperType?: string   // "poop" | "pee" | "mixed"
    size?: string          // "small" | "med" | "big" | "ginormous"
    amount?: string        // numeric string
    unit?: string          // "ml" | "milliliter" | "oz" | "ounce"
  }
}

function normalizeUnit(raw: string | undefined): 'ml' | 'oz' {
  if (!raw) return 'ml'
  const lower = raw.toLowerCase()
  if (lower.includes('oz') || lower.includes('ounce')) return 'oz'
  return 'ml'
}

function normalizeDiaperType(raw: string | undefined): 'pee' | 'poop' | 'mixed' {
  if (!raw) return 'poop'
  const lower = raw.toLowerCase()
  if (lower.includes('pee') || lower.includes('wee') || lower.includes('wet')) return 'pee'
  if (lower.includes('mixed') || lower.includes('both')) return 'mixed'
  return 'poop'
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
  // Basic auth check — Alexa should pass a shared secret header or use account linking
  const authHeader = req.headers.get('x-alexa-secret')
  if (authHeader !== process.env.ALEXA_SHARED_SECRET && process.env.ALEXA_SHARED_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: AlexaRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { userId, intent, slots = {} } = body

  if (!userId || !intent) {
    return NextResponse.json({ error: 'Missing userId or intent' }, { status: 400 })
  }

  // Look up the baby for this user
  const { data: caregiver } = await supabaseAdmin
    .from('baby_caregivers')
    .select('baby_id')
    .eq('user_id', userId)
    .limit(1)
    .single()

  if (!caregiver) {
    return NextResponse.json({
      speech: "I couldn't find a baby linked to your account. Please open TinyTrackerIO first.",
      success: false,
    })
  }

  const babyId = caregiver.baby_id

  // ── INTENT: AddDiaper ────────────────────────────────
  if (intent === 'AddDiaper' || intent === 'AddPoop' || intent === 'AddPee') {
    const type = intent === 'AddPee' ? 'pee' : intent === 'AddPoop' ? 'poop' : normalizeDiaperType(slots.diaperType)
    const size = normalizeDiaperSize(slots.size)

    await supabaseAdmin.from('diapers').insert({
      baby_id: babyId,
      logged_by: userId,
      type,
      size,
    })

    const sizeWords: Record<string, string> = { small: 'small', med: 'medium', big: 'big', ginormous: 'ginormous' }
    return NextResponse.json({
      speech: `Got it! Logged a ${sizeWords[size]} ${type} diaper for your baby.`,
      success: true,
    })
  }

  // ── INTENT: AddFeeding ───────────────────────────────
  if (intent === 'AddFeeding') {
    const rawAmount = slots.amount ? parseFloat(slots.amount) : null
    if (!rawAmount || isNaN(rawAmount)) {
      return NextResponse.json({
        speech: 'How much did the baby eat? Please say something like "add 120 milliliters" or "add 4 ounces".',
        success: false,
      })
    }

    const unit = normalizeUnit(slots.unit)
    const amountMl = unit === 'oz' ? ozToMl(rawAmount) : Math.round(rawAmount)

    await supabaseAdmin.from('feedings').insert({
      baby_id: babyId,
      logged_by: userId,
      amount_ml: amountMl,
    })

    return NextResponse.json({
      speech: `Done! I logged ${rawAmount} ${unit} for your baby.`,
      success: true,
    })
  }

  // ── INTENT: StartSleep ───────────────────────────────
  if (intent === 'StartSleep') {
    await supabaseAdmin.from('sleeps').insert({
      baby_id: babyId,
      logged_by: userId,
    })
    return NextResponse.json({
      speech: 'Sleep started! Sweet dreams, little one.',
      success: true,
    })
  }

  // ── INTENT: EndSleep ─────────────────────────────────
  if (intent === 'EndSleep') {
    const { data: activeSleep } = await supabaseAdmin
      .from('sleeps')
      .select('id')
      .eq('baby_id', babyId)
      .is('ended_at', null)
      .single()

    if (!activeSleep) {
      return NextResponse.json({ speech: "I didn't find an active sleep session to end.", success: false })
    }

    await supabaseAdmin.from('sleeps').update({ ended_at: new Date().toISOString() }).eq('id', activeSleep.id)
    return NextResponse.json({ speech: 'Sleep ended. Good morning!', success: true })
  }

  return NextResponse.json({ speech: "I didn't understand that command.", success: false })
}
