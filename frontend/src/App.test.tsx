import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'
import { vi } from 'vitest'
import App from './App'
import { UserSummary } from './types'

const authValue = {
  isLoading: false,
  isAuthEnabled: false,
  user: { id: 1, username: 'tester', role: 'admin' } as UserSummary,
  activeWorkspace: { id: 1, key: 'default', name: 'Default', artifacts_path: '/tmp' },
  workspaces: [{ id: 1, key: 'default', name: 'Default', artifacts_path: '/tmp' }],
  accessToken: null,
  refreshToken: null,
  login: vi.fn(),
  logout: vi.fn(),
  switchWorkspace: vi.fn(),
}

vi.mock('./context/AuthContext', () => ({
  useAuth: () => authValue,
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

describe('App layout', () => {
  it('keeps the sidebar fixed while main content scrolls', () => {
    const { container } = render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    )

    const appShell = container.firstElementChild as HTMLElement | null
    expect(appShell).not.toBeNull()
    expect(appShell).toHaveClass('overflow-hidden')

    const sidebar = screen.getByRole('complementary')
    expect(sidebar).toHaveClass('h-screen')

    const main = screen.getByRole('main')
    expect(main).toHaveClass('overflow-y-auto')
  })
})
