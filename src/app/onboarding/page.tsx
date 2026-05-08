'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const GENDERS = [
  { value: 'male', label: 'Boy', emoji: '👦' },
  { value: 'female', label: 'Girl', emoji: '👧' },
  { value: 'other', label: 'Other', emoji: '🌟' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [babyName, setBabyName] = useState('')
  const [gender, setGender] = useState<string>('')
  const [birthDate, setBirthDate] = useState('')
  const [unit, setUnit] = useState<'ml' | 'oz'>('ml')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFinish() {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    // Create baby
    const { data: baby, error: babyErr } = await supabase
      .from('babies')
      .insert({
        name: babyName,
        gender: (gender || null) as 'male' | 'female' | 'other' | null,
        birth_date: birthDate || null,
        created_by: user.id,
      })
      .select()
      .single()

    if (babyErr || !baby) {
      setError(babyErr?.message ?? 'Failed to create baby profile')
      setLoading(false)
      return
    }

    // Add as owner caregiver
    await supabase.from('baby_caregivers').insert({
      baby_id: baby.id,
      user_id: user.id,
      role: 'owner',
    })

    // Save unit preference
    await supabase.from('profiles').update({ unit_preference: unit }).eq('id', user.id)

    router.push('/')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-rose-100 to-rose-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">👶</div>
          <h1 className="text-2xl font-bold text-rose-700">Let&apos;s set up your baby</h1>
          <div className="flex gap-2 justify-center mt-3">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-2 rounded-full transition-all ${s <= step ? 'bg-rose-500 w-8' : 'bg-rose-200 w-4'}`}
              />
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6">
          {error && (
            <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="font-semibold text-gray-800 text-lg">What&apos;s your baby&apos;s name?</h2>
              <input
                type="text"
                value={babyName}
                onChange={(e) => setBabyName(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
                placeholder="e.g. Olivia"
                autoFocus
              />
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Gender (optional)</p>
                <div className="flex gap-2">
                  {GENDERS.map((g) => (
                    <button
                      key={g.value}
                      type="button"
                      onClick={() => setGender(g.value)}
                      className={`flex-1 flex flex-col items-center py-3 rounded-xl border-2 transition text-sm font-medium
                        ${gender === g.value ? 'border-rose-400 bg-rose-50' : 'border-gray-200 hover:border-rose-200'}`}
                    >
                      <span className="text-2xl">{g.emoji}</span>
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={() => setStep(2)}
                disabled={!babyName.trim()}
                className="w-full bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-xl py-3 transition disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="font-semibold text-gray-800 text-lg">When was {babyName} born?</h2>
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
              />
              <p className="text-xs text-gray-400">Optional — used to show age</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 border border-gray-200 text-gray-600 font-medium rounded-xl py-3 hover:bg-gray-50 transition"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="flex-1 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-xl py-3 transition"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="font-semibold text-gray-800 text-lg">Formula measurement unit</h2>
              <p className="text-sm text-gray-500">You can change this later in settings. The app auto-converts for other caregivers with different preferences.</p>
              <div className="flex gap-3">
                {(['ml', 'oz'] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setUnit(u)}
                    className={`flex-1 py-4 rounded-xl border-2 font-bold text-lg transition
                      ${unit === u ? 'border-rose-400 bg-rose-50 text-rose-700' : 'border-gray-200 hover:border-rose-200 text-gray-600'}`}
                  >
                    {u}
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 border border-gray-200 text-gray-600 font-medium rounded-xl py-3 hover:bg-gray-50 transition"
                >
                  Back
                </button>
                <button
                  onClick={handleFinish}
                  disabled={loading}
                  className="flex-1 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-xl py-3 transition disabled:opacity-50"
                >
                  {loading ? 'Setting up…' : "Let's go! 🎉"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
