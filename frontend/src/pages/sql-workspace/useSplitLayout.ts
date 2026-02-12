import { useCallback, useEffect, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'

interface UseSplitLayoutOptions {
  initialLeftPaneWidth: number
  initialBottomPaneHeight: number
  initialEditorFocused?: boolean
  onChange?: (next: { leftPaneWidth: number; bottomPaneHeight: number; isEditorFocused: boolean }) => void
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export const useSplitLayout = ({
  initialLeftPaneWidth,
  initialBottomPaneHeight,
  initialEditorFocused = false,
  onChange,
}: UseSplitLayoutOptions) => {
  const [leftPaneWidth, setLeftPaneWidth] = useState(clamp(initialLeftPaneWidth, 220, 520))
  const [bottomPaneHeight, setBottomPaneHeight] = useState(clamp(initialBottomPaneHeight, 180, 520))
  const [isEditorFocused, setIsEditorFocused] = useState(Boolean(initialEditorFocused))

  useEffect(() => {
    setLeftPaneWidth(clamp(initialLeftPaneWidth, 220, 520))
  }, [initialLeftPaneWidth])

  useEffect(() => {
    setBottomPaneHeight(clamp(initialBottomPaneHeight, 180, 520))
  }, [initialBottomPaneHeight])

  useEffect(() => {
    setIsEditorFocused(Boolean(initialEditorFocused))
  }, [initialEditorFocused])

  useEffect(() => {
    onChange?.({ leftPaneWidth, bottomPaneHeight, isEditorFocused })
  }, [bottomPaneHeight, isEditorFocused, leftPaneWidth, onChange])

  const focusEditor = useCallback(() => {
    setIsEditorFocused(true)
  }, [])

  const resetLayout = useCallback(() => {
    setLeftPaneWidth(320)
    setBottomPaneHeight(280)
    setIsEditorFocused(false)
  }, [])

  const startLeftResize = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = leftPaneWidth

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX
      setLeftPaneWidth(clamp(startWidth + deltaX, 220, 520))
    }

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }, [leftPaneWidth])

  const startBottomResize = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    event.preventDefault()
    const startY = event.clientY
    const startHeight = bottomPaneHeight

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY
      setBottomPaneHeight(clamp(startHeight - deltaY, 180, 520))
    }

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }, [bottomPaneHeight])

  return {
    leftPaneWidth,
    setLeftPaneWidth,
    bottomPaneHeight,
    setBottomPaneHeight,
    isEditorFocused,
    setIsEditorFocused,
    focusEditor,
    resetLayout,
    startLeftResize,
    startBottomResize,
  }
}
