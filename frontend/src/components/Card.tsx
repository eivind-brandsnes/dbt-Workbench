import { ReactNode } from 'react'

interface CardProps {
  title: string
  children: ReactNode
}

export function Card({ title, children }: CardProps) {
  return (
    <div className="panel-gradient rounded-lg p-4">
      <div className="mb-2 text-sm uppercase tracking-wide text-muted">{title}</div>
      <div className="text-xl font-semibold text-text">{children}</div>
    </div>
  )
}
