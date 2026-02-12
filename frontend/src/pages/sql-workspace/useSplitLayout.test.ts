import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useSplitLayout } from './useSplitLayout'

describe('useSplitLayout', () => {
  it('clamps initial values and toggles focus/reset presets', () => {
    const onChange = vi.fn()
    const { result } = renderHook(() =>
      useSplitLayout({
        initialLeftPaneWidth: 100,
        initialBottomPaneHeight: 999,
        initialEditorFocused: false,
        onChange,
      }),
    )

    expect(result.current.leftPaneWidth).toBe(220)
    expect(result.current.bottomPaneHeight).toBe(520)

    act(() => {
      result.current.focusEditor()
    })
    expect(result.current.isEditorFocused).toBe(true)

    act(() => {
      result.current.resetLayout()
    })

    expect(result.current.leftPaneWidth).toBe(320)
    expect(result.current.bottomPaneHeight).toBe(280)
    expect(result.current.isEditorFocused).toBe(false)
    expect(onChange).toHaveBeenCalled()
  })

  it('resizes panes via mouse drag handlers', () => {
    const { result } = renderHook(() =>
      useSplitLayout({
        initialLeftPaneWidth: 320,
        initialBottomPaneHeight: 280,
      }),
    )

    act(() => {
      result.current.startLeftResize({ preventDefault: () => undefined, clientX: 100 } as any)
    })
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 160 }))
      window.dispatchEvent(new MouseEvent('mouseup'))
    })

    expect(result.current.leftPaneWidth).toBe(380)

    act(() => {
      result.current.startBottomResize({ preventDefault: () => undefined, clientY: 500 } as any)
    })
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientY: 450 }))
      window.dispatchEvent(new MouseEvent('mouseup'))
    })

    expect(result.current.bottomPaneHeight).toBe(330)
  })
})
