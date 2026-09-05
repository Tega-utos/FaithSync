'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface UseWebRTCAudioOptions {
  roomId: string | null
  userId: string | null
  userName?: string
  isEnabled: boolean
  onSpeakingChange?: (isSpeaking: boolean) => void
  onPeerSpeakingChange?: (peerId: string, isSpeaking: boolean) => void
}

interface PeerConnectionState {
  pc: RTCPeerConnection
  audioElement: HTMLAudioElement
  isMuted: boolean
  isSpeaking: boolean
}

export function useWebRTCAudio({
  roomId,
  userId,
  userName = 'Member',
  isEnabled,
  onSpeakingChange,
  onPeerSpeakingChange,
}: UseWebRTCAudioOptions) {
  const [isMicMuted, setIsMicMuted] = useState(true) // Muted by default on entry
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false)
  const [isSelfSpeaking, setIsSelfSpeaking] = useState(false)
  const [activePeers, setActivePeers] = useState<string[]>([])
  const [speakingPeers, setSpeakingPeers] = useState<Record<string, boolean>>({})
  const [peerMuteStates, setPeerMuteStates] = useState<Record<string, boolean>>({})
  const [isInitialized, setIsInitialized] = useState(false)
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null)

  const localStreamRef = useRef<MediaStream | null>(null)
  const peerConnectionsRef = useRef<Map<string, PeerConnectionState>>(new Map())
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const iceServersRef = useRef<RTCIceServer[]>([{ urls: 'stun:stun.l.google.com:19302' }])
  const channelRef = useRef<any>(null)

  // 1. Fetch ICE Servers configuration (STUN/TURN)
  useEffect(() => {
    fetch('/api/webrtc/ice-servers')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data?.iceServers) && data.iceServers.length > 0) {
          iceServersRef.current = data.iceServers
        }
      })
      .catch((err) => {
        console.warn('Fallback to standard STUN server:', err)
      })
  }, [])

  // 2. Setup Local Audio Stream & Speaking Decibel Monitor
  const setupLocalAudio = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      })

      // Ensure tracks start muted by default
      stream.getAudioTracks().forEach((track) => {
        track.enabled = false
      })

      localStreamRef.current = stream
      setHasMicPermission(true)
      setIsMicMuted(true)

      // Audio analysis for speaking detection
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
        if (AudioCtx) {
          const ctx = new AudioCtx()
          audioContextRef.current = ctx
          const source = ctx.createMediaStreamSource(stream)
          const analyser = ctx.createAnalyser()
          analyser.fftSize = 256
          analyser.smoothingTimeConstant = 0.5
          source.connect(analyser)
          analyserRef.current = analyser

          const bufferLength = analyser.frequencyBinCount
          const dataArray = new Uint8Array(bufferLength)

          let speakingCount = 0
          const checkVolume = () => {
            if (!analyserRef.current || !localStreamRef.current) return

            const isAudioTrackLive = localStreamRef.current
              .getAudioTracks()
              .some((t) => t.enabled)

            if (isAudioTrackLive) {
              analyserRef.current.getByteFrequencyData(dataArray)
              let sum = 0
              for (let i = 0; i < bufferLength; i++) {
                sum += dataArray[i]
              }
              const average = sum / bufferLength

              // Threshold for human voice activity
              if (average > 18) {
                speakingCount = Math.min(speakingCount + 1, 10)
              } else {
                speakingCount = Math.max(speakingCount - 1, 0)
              }

              const speaking = speakingCount >= 2
              setIsSelfSpeaking((prev) => {
                if (prev !== speaking) {
                  onSpeakingChange?.(speaking)
                  if (channelRef.current && userId) {
                    channelRef.current.send({
                      type: 'broadcast',
                      event: 'speaking_state',
                      payload: { peerId: userId, isSpeaking: speaking },
                    })
                  }
                }
                return speaking
              })
            } else {
              setIsSelfSpeaking((prev) => {
                if (prev) {
                  onSpeakingChange?.(false)
                  if (channelRef.current && userId) {
                    channelRef.current.send({
                      type: 'broadcast',
                      event: 'speaking_state',
                      payload: { peerId: userId, isSpeaking: false },
                    })
                  }
                }
                return false
              })
            }

            animFrameRef.current = requestAnimationFrame(checkVolume)
          }

          animFrameRef.current = requestAnimationFrame(checkVolume)
        }
      } catch (audioCtxErr) {
        console.warn('AudioContext voice detector error:', audioCtxErr)
      }

      return stream
    } catch (err: any) {
      console.warn('Mic permission error / denied:', err)
      setHasMicPermission(false)
      return null
    }
  }, [onSpeakingChange, userId])

  // 3. Create Peer Connection for a specific peer
  const createPeerConnection = useCallback(
    (targetPeerId: string, isInitiator: boolean) => {
      if (peerConnectionsRef.current.has(targetPeerId)) {
        return peerConnectionsRef.current.get(targetPeerId)!.pc
      }

      const pc = new RTCPeerConnection({
        iceServers: iceServersRef.current,
        iceCandidatePoolSize: 2,
      })

      // Audio element to play remote stream
      const audioEl = new Audio()
      audioEl.autoplay = true
      audioEl.muted = isSpeakerMuted
      ;(audioEl as any).playsInline = true

      // Attach remote tracks
      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          audioEl.srcObject = event.streams[0]
          audioEl.play().catch((playErr) => {
            console.warn('Auto-play blocked or waiting for user interaction:', playErr)
          })
        }
      }

      // Add local audio tracks if available
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!)
        })
      }

      // Send local ICE candidates to peer
      pc.onicecandidate = (event) => {
        if (event.candidate && channelRef.current && userId) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'ice_candidate',
            payload: {
              senderId: userId,
              targetId: targetPeerId,
              candidate: event.candidate,
            },
          })
        }
      }

      pc.onconnectionstatechange = () => {
        if (
          pc.connectionState === 'disconnected' ||
          pc.connectionState === 'failed' ||
          pc.connectionState === 'closed'
        ) {
          setActivePeers((prev) => prev.filter((id) => id !== targetPeerId))
          setSpeakingPeers((prev) => {
            const next = { ...prev }
            delete next[targetPeerId]
            return next
          })
        } else if (pc.connectionState === 'connected') {
          setActivePeers((prev) => (prev.includes(targetPeerId) ? prev : [...prev, targetPeerId]))
        }
      }

      peerConnectionsRef.current.set(targetPeerId, {
        pc,
        audioElement: audioEl,
        isMuted: false,
        isSpeaking: false,
      })

      // Initiator creates and sends SDP offer
      if (isInitiator) {
        pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: false,
        })
          .then((offer) => pc.setLocalDescription(offer))
          .then(() => {
            if (channelRef.current && userId) {
              channelRef.current.send({
                type: 'broadcast',
                event: 'offer',
                payload: {
                  senderId: userId,
                  targetId: targetPeerId,
                  sdp: pc.localDescription,
                },
              })
            }
          })
          .catch((err) => console.error('Error creating offer:', err))
      }

      return pc
    },
    [isSpeakerMuted, userId]
  )

  // 4. Main Lifecycle: Connect to Supabase Realtime Signaling Channel
  useEffect(() => {
    if (!isEnabled || !roomId || !userId) return

    let isMounted = true
    const supabase = createClient()
    const channelName = `live_webrtc_room_${roomId}`
    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    })
    channelRef.current = channel

    // Initialize local audio on mount
    setupLocalAudio().then(() => {
      if (!isMounted) return
      setIsInitialized(true)

      // Subscribe and announce presence
      channel
        .on('broadcast', { event: 'peer_join' }, async ({ payload }) => {
          if (!payload || payload.senderId === userId) return
          const peerId = payload.senderId
          // When a new peer joins, establish connection (we act as initiator)
          createPeerConnection(peerId, true)
        })
        .on('broadcast', { event: 'offer' }, async ({ payload }) => {
          if (!payload || payload.targetId !== userId) return
          const { senderId, sdp } = payload
          const pc = createPeerConnection(senderId, false)
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(sdp))
            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)
            channel.send({
              type: 'broadcast',
              event: 'answer',
              payload: {
                senderId: userId,
                targetId: senderId,
                sdp: pc.localDescription,
              },
            })
          } catch (offerErr) {
            console.error('Error handling offer:', offerErr)
          }
        })
        .on('broadcast', { event: 'answer' }, async ({ payload }) => {
          if (!payload || payload.targetId !== userId) return
          const { senderId, sdp } = payload
          const peerState = peerConnectionsRef.current.get(senderId)
          if (peerState?.pc) {
            try {
              await peerState.pc.setRemoteDescription(new RTCSessionDescription(sdp))
            } catch (ansErr) {
              console.error('Error handling answer:', ansErr)
            }
          }
        })
        .on('broadcast', { event: 'ice_candidate' }, async ({ payload }) => {
          if (!payload || payload.targetId !== userId) return
          const { senderId, candidate } = payload
          const peerState = peerConnectionsRef.current.get(senderId)
          if (peerState?.pc && candidate) {
            try {
              await peerState.pc.addIceCandidate(new RTCIceCandidate(candidate))
            } catch (iceErr) {
              console.warn('ICE candidate addition error:', iceErr)
            }
          }
        })
        .on('broadcast', { event: 'mute_state' }, ({ payload }) => {
          if (!payload) return
          const { peerId, isMuted } = payload
          setPeerMuteStates((prev) => ({ ...prev, [peerId]: isMuted }))
        })
        .on('broadcast', { event: 'speaking_state' }, ({ payload }) => {
          if (!payload) return
          const { peerId, isSpeaking } = payload
          setSpeakingPeers((prev) => ({ ...prev, [peerId]: isSpeaking }))
          onPeerSpeakingChange?.(peerId, isSpeaking)
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            // Broadcast our arrival
            channel.send({
              type: 'broadcast',
              event: 'peer_join',
              payload: { senderId: userId, userName },
            })
          }
        })
    })

    return () => {
      isMounted = false
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {})
      }

      // Close all peer connections & stop audio tracks
      peerConnectionsRef.current.forEach(({ pc, audioElement }) => {
        try {
          audioElement.srcObject = null
          audioElement.pause()
          pc.close()
        } catch {
          // ignore
        }
      })
      peerConnectionsRef.current.clear()

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop())
        localStreamRef.current = null
      }

      if (channelRef.current) {
        channelRef.current.unsubscribe()
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [isEnabled, roomId, userId, userName, setupLocalAudio, createPeerConnection, onPeerSpeakingChange])

  // 5. Toggle Local Microphone Mute / Unmute
  const toggleMic = useCallback(async () => {
    if (!localStreamRef.current) {
      await setupLocalAudio()
    }

    if (localStreamRef.current) {
      const nextMuted = !isMicMuted
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !nextMuted
      })
      setIsMicMuted(nextMuted)

      // Broadcast mute status to peers
      if (channelRef.current && userId) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'mute_state',
          payload: { peerId: userId, isMuted: nextMuted },
        })
      }
      return !nextMuted
    }
    return false
  }, [isMicMuted, setupLocalAudio, userId])

  // 6. Toggle Speaker (Mute / Unmute incoming peer voice)
  const toggleSpeaker = useCallback(() => {
    const nextSpeakerMuted = !isSpeakerMuted
    setIsSpeakerMuted(nextSpeakerMuted)
    peerConnectionsRef.current.forEach(({ audioElement }) => {
      audioElement.muted = nextSpeakerMuted
    })
    return nextSpeakerMuted
  }, [isSpeakerMuted])

  return {
    isMicMuted,
    isSpeakerMuted,
    isSelfSpeaking,
    hasMicPermission,
    isInitialized,
    activePeers,
    speakingPeers,
    peerMuteStates,
    toggleMic,
    toggleSpeaker,
  }
}
