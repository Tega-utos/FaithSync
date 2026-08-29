'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface UseWebRTCVoiceOptions {
  roomId: string
  userId: string
  groupId?: string
  isMuted?: boolean
  onSpeakingChange?: (userId: string, isSpeaking: boolean) => void
  onReactionReceived?: (reaction: { userId: string; emoji: string; id: string }) => void
}

export function useWebRTCVoice({
  roomId,
  userId,
  groupId,
  isMuted = false,
  onSpeakingChange,
  onReactionReceived,
}: UseWebRTCVoiceOptions) {
  const [iceServers, setIceServers] = useState<RTCIceServer[]>([
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ])
  const [isSpeakingLocally, setIsSpeakingLocally] = useState(false)
  const [activeSpeakers, setActiveSpeakers] = useState<Record<string, boolean>>({})

  const localStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const channelRef = useRef<any>(null)
  const speakingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // 1. Fetch ICE Servers with Secure Server-Side TURN Provider Credentials
  useEffect(() => {
    async function loadIceServers() {
      try {
        const res = await fetch('/api/webrtc/ice-servers')
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data.iceServers) && data.iceServers.length > 0) {
            setIceServers(data.iceServers)
          }
        }
      } catch (err) {
        console.error('Failed to load ICE servers:', err)
      }
    }
    loadIceServers()
  }, [])

  // 2. Setup Supabase Realtime Broadcast Channel (Ephemeral: 0 DB Writes)
  useEffect(() => {
    if (!roomId) return

    const supabase = createClient()
    const channelName = `room:${groupId || roomId}`
    const channel = supabase.channel(channelName)

    channel
      .on('broadcast', { event: 'speaking' }, ({ payload }) => {
        if (payload?.userId) {
          setActiveSpeakers((prev) => ({
            ...prev,
            [payload.userId]: !!payload.isSpeaking,
          }))
          if (onSpeakingChange) {
            onSpeakingChange(payload.userId, !!payload.isSpeaking)
          }
        }
      })
      .on('broadcast', { event: 'reaction' }, ({ payload }) => {
        if (payload && onReactionReceived) {
          onReactionReceived(payload)
        }
      })
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [roomId, groupId, onSpeakingChange, onReactionReceived])

  // 3. Setup Local Audio Stream & Throttled 200ms Speaking Detection Broadcast
  useEffect(() => {
    let isCancelled = false

    async function initAudio() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        })

        if (isCancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }

        localStreamRef.current = stream

        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
        if (AudioCtx) {
          const audioCtx = new AudioCtx()
          const analyser = audioCtx.createAnalyser()
          analyser.fftSize = 256
          const source = audioCtx.createMediaStreamSource(stream)
          source.connect(analyser)

          audioContextRef.current = audioCtx
          analyserRef.current = analyser

          const dataArray = new Uint8Array(analyser.frequencyBinCount)
          const SPEAKING_THRESHOLD = 25

          speakingIntervalRef.current = setInterval(() => {
            if (isMuted || !analyserRef.current) {
              if (isSpeakingLocally) {
                setIsSpeakingLocally(false)
                channelRef.current?.send({
                  type: 'broadcast',
                  event: 'speaking',
                  payload: { userId, isSpeaking: false },
                })
              }
              return
            }

            analyserRef.current.getByteFrequencyData(dataArray)
            let sum = 0
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i]
            }
            const average = sum / dataArray.length
            const isSpeaking = average > SPEAKING_THRESHOLD

            setIsSpeakingLocally(isSpeaking)

            if (channelRef.current) {
              channelRef.current.send({
                type: 'broadcast',
                event: 'speaking',
                payload: { userId, isSpeaking },
              })
            }
          }, 200) // Throttled 200ms: no DB writes
        }
      } catch (micErr) {
        console.warn('Microphone access note:', micErr)
      }
    }

    initAudio()

    return () => {
      isCancelled = true
      if (speakingIntervalRef.current) {
        clearInterval(speakingIntervalRef.current)
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {})
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop())
      }
    }
  }, [roomId, userId, isMuted])

  // 4. Send Floating Live Reaction (Ephemeral Realtime Broadcast)
  const sendReaction = useCallback(
    (emoji: string) => {
      if (!channelRef.current || !userId) return
      const reactionPayload = {
        userId,
        emoji,
        id: `react-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      }
      channelRef.current.send({
        type: 'broadcast',
        event: 'reaction',
        payload: reactionPayload,
      })
      if (onReactionReceived) {
        onReactionReceived(reactionPayload)
      }
    },
    [userId, onReactionReceived]
  )

  return {
    iceServers,
    isSpeakingLocally,
    activeSpeakers,
    sendReaction,
  }
}
