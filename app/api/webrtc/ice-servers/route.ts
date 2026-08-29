import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // 1. Fallback High-Availability Public STUN Servers
    const iceServers: RTCIceServer[] = [
      {
        urls: [
          'stun:stun.l.google.com:19302',
          'stun:stun1.l.google.com:19302',
          'stun:stun2.l.google.com:19302',
          'stun:stun3.l.google.com:19302',
          'stun:stun4.l.google.com:19302',
        ],
      },
    ]

    // 2. Load Server-Only TURN Provider Credentials
    // Keys are kept strictly on server-side and never exposed to client bundles
    const turnUrl = process.env.TURN_URL || process.env.NEXT_PUBLIC_TURN_URL
    const turnUsername = process.env.TURN_USERNAME
    const turnCredential = process.env.TURN_CREDENTIAL

    if (turnUrl && turnUsername && turnCredential) {
      iceServers.push({
        urls: turnUrl,
        username: turnUsername,
        credential: turnCredential,
      })
    }

    // Support for Twilio Network Traversal API if configured
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      try {
        const twilioAuth = Buffer.from(
          `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
        ).toString('base64')

        const twilioRes = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Tokens.json`,
          {
            method: 'POST',
            headers: {
              Authorization: `Basic ${twilioAuth}`,
            },
          }
        )

        if (twilioRes.ok) {
          const twilioData = await twilioRes.json()
          if (Array.isArray(twilioData.ice_servers)) {
            iceServers.push(...twilioData.ice_servers)
          }
        }
      } catch (twilioErr) {
        console.error('Twilio ICE fetch note:', twilioErr)
      }
    }

    return NextResponse.json({
      iceServers,
      ttl: 86400,
    })
  } catch (error: any) {
    console.error('ICE servers endpoint error:', error)
    return NextResponse.json(
      {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      },
      { status: 200 }
    )
  }
}
