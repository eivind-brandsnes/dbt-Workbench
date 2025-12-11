interface TopBarProps {
  projectName?: string
  environment?: string
}

export function TopBar({ projectName = 'Default dbt Project', environment = 'Local' }: TopBarProps) {
  return (
    <header className="flex items-center justify-between border-b border-gray-800 px-6 py-4 bg-panel sticky top-0 z-10">
      <div>
        <div className="text-sm uppercase text-gray-400">Project</div>
        <div className="text-lg font-semibold text-white">{projectName}</div>
      </div>
      <div className="text-sm text-gray-300 bg-gray-800 px-3 py-1 rounded-full">{environment}</div>
    </header>
  )
}
