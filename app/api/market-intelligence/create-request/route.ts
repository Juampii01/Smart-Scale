import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { platform, timeframe_days, competitors, access_token, client_id } = body

    if (!access_token) {
      return NextResponse.json({ error: 'No access_token provided' }, { status: 401 })
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'Missing Supabase environment variables' },
        { status: 500 }
      )
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    )

    let sub = null
    try {
      const payload = JSON.parse(
        Buffer.from(access_token.split('.')[1], 'base64').toString('utf8')
      )
      sub = payload.sub
    } catch (e) {
      return NextResponse.json({ error: 'Invalid access_token' }, { status: 401 })
    }

    const user_id = sub

    if (!['youtube', 'instagram', 'tiktok'].includes(platform))
      return NextResponse.json({ error: 'Invalid platform' }, { status: 400 })

    if (![30, 60, 90].includes(timeframe_days))
      return NextResponse.json({ error: 'Invalid timeframe' }, { status: 400 })

    if (!Array.isArray(competitors) || competitors.length < 1 || competitors.length > 5)
      return NextResponse.json({ error: 'Invalid competitors' }, { status: 400 })

    if (!competitors.every((url: string) => /^https:\/\/.+/.test(url)))
      return NextResponse.json({ error: 'Invalid competitor URLs' }, { status: 400 })

    const insertData = {
      user_id,
      platform,
      timeframe_days,
      competitors,
      status: 'pending',
      ...(client_id ? { client_id } : {}),
    }

    const { data, error } = await supabase
      .from('research_requests')
      .insert(insertData)
      .select('id')
      .single()

    if (error) {
      console.error("Insert error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const { error: workerError } = await supabase.functions.invoke(
      "research-worker",
      {
        body: { request_id: data.id },
      }
    )

    if (workerError) {
      console.error("Worker invoke failed:", workerError)
    }

    return NextResponse.json({ request_id: data.id })
  } catch (error) {
    console.error("ROUTE CRASH:", error)
    return NextResponse.json(
      { error: 'Internal server error', detail: String(error) },
      { status: 500 }
    )
  }
}
