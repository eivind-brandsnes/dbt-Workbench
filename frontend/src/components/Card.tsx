import { ReactNode } from 'react'

interface CardProps {
  title: string
  children: ReactNode
}

export function Card({ title, children }: CardProps) {
  return (
    <div className="bg-panel border border-gray-800 rounded-lg p-4 shadow-sm">
      <div className="text-sm text-gray-400 mb-2 uppercase tracking-wide">{title}</div>
      <div className="text-xl font-semibold text-white">{children}</div>
    </div>
  )
}
