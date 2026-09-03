'use client'

import React, { useState, useEffect } from 'react'
import {
  BookOpen,
  Sparkle,
  Plus,
  Trash,
  ArrowUp,
  ArrowDown,
  FloppyDisk,
  FolderOpen,
  X,
  Check,
  CircleNotch,
  Clock,
} from '@phosphor-icons/react'
import { ScripturePicker, ScriptureSelection } from '@/components/scripture/ScripturePicker'
import { ScriptureText } from '@/components/scripture/ScriptureText'
import { createClient } from '@/lib/supabase/client'

export interface TimelineSegment {
  id: string
  type: 'scripture' | 'reflection'
  durationMinutes: number
  reference?: string
  versionId?: string
  prompt?: string
  verseText?: string
}

export interface PrayerFocusTimelineBuilderProps {
  isOpen: boolean
  onClose: () => void
  initialSegments?: TimelineSegment[]
  onApplyTimeline: (segments: TimelineSegment[], totalDurationMins: number) => void
}

const DEFAULT_REFLECTION_PROMPTS = [
  'What are you grateful for today?',
  'Where did you see God at work this week?',
  'Surrender one specific anxiety or burden to Jesus right now.',
  'Intercede for your family, accountability partner, and community.',
  'Ask for wisdom and clarity for the major decisions ahead of you.',
  'Quiet stillness: Breathe deeply and listen for the Holy Spirit in silence.',
]

export function PrayerFocusTimelineBuilder({
  isOpen,
  onClose,
  initialSegments = [],
  onApplyTimeline,
}: PrayerFocusTimelineBuilderProps) {
  const [segments, setSegments] = useState<TimelineSegment[]>(() => {
    if (initialSegments && initialSegments.length > 0) return initialSegments
    return [
      {
        id: 'seg-1',
        type: 'scripture',
        durationMinutes: 2,
        reference: 'Psalm 23:1-3',
        versionId: 'web',
      },
      {
        id: 'seg-2',
        type: 'reflection',
        durationMinutes: 3,
        prompt: 'What are you grateful for today?',
      },
      {
        id: 'seg-3',
        type: 'scripture',
        durationMinutes: 2,
        reference: 'Philippians 4:6-7',
        versionId: 'web',
      },
    ]
  })

  // Scripture Picker Sub-modal
  const [isScripturePickerOpen, setIsScripturePickerOpen] = useState(false)
  const [activeEditingSegmentId, setActiveEditingSegmentId] = useState<string | null>(null)

  // Segment Type Add Selector
  const [isAddChoiceOpen, setIsAddChoiceOpen] = useState(false)

  // Reflection Prompt Picker Sub-modal
  const [isReflectionModalOpen, setIsReflectionModalOpen] = useState(false)
  const [customPromptInput, setCustomPromptInput] = useState('')

  // Template Save / Load States
  const [isSaveTemplateOpen, setIsSaveTemplateOpen] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)

  const [isLoadTemplateOpen, setIsLoadTemplateOpen] = useState(false)
  const [savedTemplates, setSavedTemplates] = useState<{ id: string; name: string; segments: any }[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)

  const totalMinutes = segments.reduce((sum, s) => sum + (s.durationMinutes || 1), 0)

  // Fetch saved templates when Load Modal opens
  useEffect(() => {
    if (!isLoadTemplateOpen) return
    async function loadTemplates() {
      setLoadingTemplates(true)
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data } = await supabase
            .from('prayer_focus_templates')
            .select('id, name, segments, created_at')
            .order('created_at', { ascending: false })
          if (data) setSavedTemplates(data as any)
        }
      } catch (err) {
        console.error('Failed to load templates:', err)
      } finally {
        setLoadingTemplates(false)
      }
    }
    loadTemplates()
  }, [isLoadTemplateOpen])

  if (!isOpen) return null

  // Reordering
  const handleMoveUp = (index: number) => {
    if (index === 0) return
    const newArr = [...segments]
    const temp = newArr[index - 1]
    newArr[index - 1] = newArr[index]
    newArr[index] = temp
    setSegments(newArr)
  }

  const handleMoveDown = (index: number) => {
    if (index === segments.length - 1) return
    const newArr = [...segments]
    const temp = newArr[index + 1]
    newArr[index + 1] = newArr[index]
    newArr[index] = temp
    setSegments(newArr)
  }

  const handleRemoveSegment = (id: string) => {
    setSegments((prev) => prev.filter((s) => s.id !== id))
  }

  const handleUpdateDuration = (id: string, mins: number) => {
    const validMins = Math.max(1, Math.min(60, mins || 1))
    setSegments((prev) =>
      prev.map((s) => (s.id === id ? { ...s, durationMinutes: validMins } : s))
    )
  }

  // Scripture selection
  const handleSelectScripture = (selection: ScriptureSelection) => {
    if (activeEditingSegmentId) {
      setSegments((prev) =>
        prev.map((s) =>
          s.id === activeEditingSegmentId
            ? {
                ...s,
                reference: selection.reference,
                versionId: selection.versionId,
                verseText: selection.text,
              }
            : s
        )
      )
      setActiveEditingSegmentId(null)
    } else {
      const newSeg: TimelineSegment = {
        id: `seg-${Date.now()}`,
        type: 'scripture',
        durationMinutes: 2,
        reference: selection.reference,
        versionId: selection.versionId,
        verseText: selection.text,
      }
      setSegments((prev) => [...prev, newSeg])
    }
  }

  // Add Reflection Segment
  const handleAddReflection = (promptText: string) => {
    if (!promptText.trim()) return
    const newSeg: TimelineSegment = {
      id: `seg-${Date.now()}`,
      type: 'reflection',
      durationMinutes: 3,
      prompt: promptText.trim(),
    }
    setSegments((prev) => [...prev, newSeg])
    setIsReflectionModalOpen(false)
    setCustomPromptInput('')
  }

  // Save Template
  const handleSaveTemplate = async () => {
    if (!templateName.trim() || segments.length === 0) return
    setSavingTemplate(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('prayer_focus_templates').insert({
          user_id: user.id,
          name: templateName.trim(),
          segments: segments as any,
        })
        setIsSaveTemplateOpen(false)
        setTemplateName('')
      }
    } catch (err) {
      console.error('Failed to save template:', err)
    } finally {
      setSavingTemplate(false)
    }
  }

  // Apply Timeline
  const handleApply = () => {
    if (segments.length === 0) return
    onApplyTimeline(segments, totalMinutes)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative z-10 w-full max-w-xl bg-surface border border-border rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 sm:p-6 space-y-4 animate-in slide-in-from-bottom duration-300 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#0E0E0E] dark:bg-white/90 text-white dark:text-[#0E0E0E] flex items-center justify-center shadow-xs">
              <Clock size={18} weight="bold" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text-primary">Prayer Focus Timeline</h2>
              <p className="text-[10px] text-text-secondary">
                Sequence scripture & reflection prompts across your session
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsLoadTemplateOpen(true)}
              className="p-2 rounded-xl bg-card border border-border text-text-secondary hover:text-text-primary text-xs font-bold transition-all"
              title="Load Saved Template"
            >
              <FolderOpen size={16} />
            </button>
            <button
              type="button"
              onClick={() => setIsSaveTemplateOpen(true)}
              disabled={segments.length === 0}
              className="p-2 rounded-xl bg-card border border-border text-text-secondary hover:text-text-primary text-xs font-bold transition-all disabled:opacity-40"
              title="Save as Template"
            >
              <FloppyDisk size={16} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-[#E5E7EB] text-text-secondary transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Total Duration Banner */}
        <div className="p-3 rounded-2xl bg-[#FDF9F1] dark:bg-amber-950/30 border border-[#FBBF24]/35 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Sparkle size={18} weight="fill" className="text-[#FBBF24]" />
            <div>
              <p className="text-xs font-bold text-text-primary">
                Total Timeline: {totalMinutes} Minutes
              </p>
              <p className="text-[10px] text-text-secondary">
                {segments.length} guided segment{segments.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>
          <span className="text-[10px] font-bold font-mono text-[#FBBF24] bg-card px-2 py-0.5 rounded-lg border border-border">
            Auto-advancing
          </span>
        </div>

        {/* Segments List */}
        <div className="overflow-y-auto flex-1 space-y-2.5 pr-0.5">
          {segments.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <p className="text-xs font-bold text-text-primary">No segments in your timeline</p>
              <p className="text-[11px] text-text-secondary">
                Tap &ldquo;Add Segment&rdquo; below to add scripture readings or reflection prompts.
              </p>
            </div>
          ) : (
            segments.map((seg, idx) => {
              const isScripture = seg.type === 'scripture'
              return (
                <div
                  key={seg.id}
                  className="p-3.5 rounded-2xl bg-card border border-border shadow-xs space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-[#0E0E0E] dark:bg-white/90 text-white dark:text-[#0E0E0E] text-[10px] font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span
                        className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border ${
                          isScripture
                            ? 'bg-[#FDF9F1] dark:bg-amber-950/30 text-[#FBBF24] border-[#FBBF24]/30 dark:border-amber-500/25'
                            : 'bg-rose-50 dark:bg-red-950/30 text-rose-600 border-rose-200'
                        }`}
                      >
                        {isScripture ? 'Scripture' : 'Reflection'}
                      </span>
                    </div>

                    {/* Duration input & Move Controls */}
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center gap-1 bg-surface px-2 py-1 rounded-xl border border-border">
                        <input
                          type="number"
                          min="1"
                          max="60"
                          value={seg.durationMinutes}
                          onChange={(e) =>
                            handleUpdateDuration(seg.id, parseInt(e.target.value, 10))
                          }
                          className="w-8 bg-transparent text-center font-bold text-xs text-text-primary focus:outline-none font-mono"
                        />
                        <span className="text-[10px] text-text-secondary font-medium">min</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleMoveUp(idx)}
                        disabled={idx === 0}
                        className="p-1 rounded-lg text-text-secondary hover:text-text-primary hover:bg-subtle disabled:opacity-20"
                        title="Move Up"
                      >
                        <ArrowUp size={14} weight="bold" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleMoveDown(idx)}
                        disabled={idx === segments.length - 1}
                        className="p-1 rounded-lg text-text-secondary hover:text-text-primary hover:bg-subtle disabled:opacity-20"
                        title="Move Down"
                      >
                        <ArrowDown size={14} weight="bold" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemoveSegment(seg.id)}
                        className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 dark:bg-red-950/30 transition-colors"
                        title="Remove Segment"
                      >
                        <Trash size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Segment Content Preview */}
                  {isScripture ? (
                    <div
                      onClick={() => {
                        setActiveEditingSegmentId(seg.id)
                        setIsScripturePickerOpen(true)
                      }}
                      className="cursor-pointer hover:opacity-85 transition-opacity"
                    >
                      <ScriptureText
                        reference={seg.reference || 'Psalm 23:1'}
                        versionId={seg.versionId || 'web'}
                        display="card"
                      />
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-surface border border-border text-xs text-text-primary font-medium italic">
                      &ldquo;{seg.prompt}&rdquo;
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Add Segment Dropdown / Buttons */}
        <div className="pt-2 border-t border-border space-y-2 shrink-0">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveEditingSegmentId(null)
                setIsScripturePickerOpen(true)
              }}
              className="py-2.5 px-3 rounded-xl bg-card border border-border hover:border-[#FBBF24] text-text-primary font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs"
            >
              <BookOpen size={16} className="text-[#FBBF24]" weight="fill" />
              <span>+ Add Scripture</span>
            </button>

            <button
              type="button"
              onClick={() => setIsReflectionModalOpen(true)}
              className="py-2.5 px-3 rounded-xl bg-card border border-border hover:border-rose-400 text-text-primary font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs"
            >
              <Sparkle size={16} className="text-rose-500" weight="fill" />
              <span>+ Add Reflection</span>
            </button>
          </div>

          {/* Footer Apply Button */}
          <button
            type="button"
            onClick={handleApply}
            disabled={segments.length === 0}
            className="w-full py-3 rounded-2xl bg-[#0E0E0E] dark:bg-white/90 text-white dark:text-[#0E0E0E] font-bold text-xs shadow-md hover:bg-[#262626] dark:hover:bg-white/80 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Check size={16} weight="bold" />
            <span>Apply Timeline ({totalMinutes} Mins)</span>
          </button>
        </div>
      </div>

      {/* 1. Scripture Picker Sub-Modal */}
      <ScripturePicker
        isOpen={isScripturePickerOpen}
        onClose={() => {
          setIsScripturePickerOpen(false)
          setActiveEditingSegmentId(null)
        }}
        onSelect={handleSelectScripture}
      />

      {/* 2. Reflection Prompt Selector Sub-Modal */}
      {isReflectionModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-surface border border-border rounded-3xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="text-sm font-bold text-text-primary">Add Reflection Prompt</h3>
              <button
                onClick={() => setIsReflectionModalOpen(false)}
                className="text-text-secondary"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                Suggested Prompts
              </span>
              {DEFAULT_REFLECTION_PROMPTS.map((prompt) => (
                <div
                  key={prompt}
                  onClick={() => handleAddReflection(prompt)}
                  className="p-3 rounded-xl bg-card border border-border text-xs text-text-primary font-medium hover:border-rose-400 hover:bg-rose-50 dark:bg-red-950/30/40 cursor-pointer transition-all"
                >
                  &ldquo;{prompt}&rdquo;
                </div>
              ))}
            </div>

            <div className="space-y-2 pt-2 border-t border-border">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                Or Write Custom Prompt
              </span>
              <textarea
                rows={2}
                value={customPromptInput}
                onChange={(e) => setCustomPromptInput(e.target.value)}
                placeholder="e.g. Meditate on the goodness of God this morning..."
                className="w-full p-2.5 rounded-xl border border-border bg-card text-xs text-text-primary focus:outline-none focus:border-rose-400"
              />
              <button
                type="button"
                onClick={() => handleAddReflection(customPromptInput)}
                disabled={!customPromptInput.trim()}
                className="w-full py-2 bg-[#0E0E0E] dark:bg-white/90 text-white dark:text-[#0E0E0E] font-bold text-xs rounded-xl hover:bg-[#262626] dark:hover:bg-white/80 disabled:opacity-40 transition-colors"
              >
                Add Custom Prompt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Save Template Modal */}
      {isSaveTemplateOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-surface border border-border rounded-3xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="text-sm font-bold text-text-primary">Save as Template</h3>
              <button onClick={() => setIsSaveTemplateOpen(false)} className="text-text-secondary">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-text-secondary">
                Template Name
              </label>
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g. Morning Gratitude & Peace"
                className="w-full p-2.5 rounded-xl border border-border bg-card text-xs font-semibold text-text-primary focus:outline-none focus:border-[#FBBF24]"
              />
            </div>

            <button
              type="button"
              onClick={handleSaveTemplate}
              disabled={!templateName.trim() || savingTemplate}
              className="w-full py-2.5 rounded-xl bg-[#0E0E0E] dark:bg-white/90 text-white dark:text-[#0E0E0E] font-bold text-xs hover:bg-[#262626] dark:hover:bg-white/80 disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5"
            >
              {savingTemplate ? (
                <CircleNotch size={14} className="animate-spin text-[#FBBF24]" />
              ) : (
                <Check size={14} weight="bold" />
              )}
              <span>Save Template</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. Load Saved Templates Drawer */}
      {isLoadTemplateOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-surface border border-border rounded-3xl p-5 space-y-4 shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b border-border shrink-0">
              <h3 className="text-sm font-bold text-text-primary">Saved Focus Templates</h3>
              <button onClick={() => setIsLoadTemplateOpen(false)} className="text-text-secondary">
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-2">
              {loadingTemplates ? (
                <div className="py-8 text-center text-xs text-text-secondary">
                  <CircleNotch size={16} className="animate-spin text-[#FBBF24] mx-auto mb-2" />
                  <span>Loading templates...</span>
                </div>
              ) : savedTemplates.length === 0 ? (
                <div className="py-8 text-center text-xs text-text-secondary">
                  No saved templates found.
                </div>
              ) : (
                savedTemplates.map((tpl) => (
                  <div
                    key={tpl.id}
                    onClick={() => {
                      if (Array.isArray(tpl.segments)) {
                        setSegments(tpl.segments)
                        setIsLoadTemplateOpen(false)
                      }
                    }}
                    className="p-3 rounded-2xl bg-card border border-border hover:border-[#FBBF24] cursor-pointer transition-all space-y-1"
                  >
                    <p className="text-xs font-bold text-text-primary">{tpl.name}</p>
                    <p className="text-[10px] text-text-secondary">
                      {Array.isArray(tpl.segments) ? tpl.segments.length : 0} segments •{' '}
                      {Array.isArray(tpl.segments)
                        ? tpl.segments.reduce((s: number, seg: any) => s + (seg.durationMinutes || 1), 0)
                        : 0}{' '}
                      mins
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
