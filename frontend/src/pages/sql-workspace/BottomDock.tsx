import { SqlQueryHistoryEntry } from '../../types'
import { HistoryGrid } from './HistoryGrid'
import { OutputPanel } from './OutputPanel'
import { ProfilingGrid } from './ProfilingGrid'
import { ResultsGrid } from './ResultsGrid'
import { SqlBottomPanelTab, SqlOutputEntry, SqlResultTab } from './types'

interface BottomDockProps {
  activePanel: SqlBottomPanelTab
  onPanelChange: (panel: SqlBottomPanelTab) => void
  resultTabs: SqlResultTab[]
  activeResultTabId: string
  onActiveResultTabChange: (tabId: string) => void
  activeResultTab: SqlResultTab | null
  currentRows: Record<string, any>[]
  totalResultPages: number
  resultsPage: number
  onResultsPageChange: (page: number) => void
  profiling: any
  history: SqlQueryHistoryEntry[]
  historyPage: number
  historyTotal: number
  historyStatusFilter: string
  setHistoryStatusFilter: (value: string) => void
  historyModelFilter: string
  setHistoryModelFilter: (value: string) => void
  historyDateFrom: string
  setHistoryDateFrom: (value: string) => void
  historyDateTo: string
  setHistoryDateTo: (value: string) => void
  modelOptions: Array<{ id: string; name: string }>
  onHistoryReRun: (entry: SqlQueryHistoryEntry) => void
  onHistoryDelete: (entryId: number) => void
  onHistoryPageChange: (page: number) => void
  outputEntries: SqlOutputEntry[]
  onClearOutput: () => void
}

const panelButtons: Array<{ id: SqlBottomPanelTab; label: string }> = [
  { id: 'results', label: 'Results' },
  { id: 'profiling', label: 'Profiling' },
  { id: 'history', label: 'Query History' },
  { id: 'output', label: 'Output' },
]

export const BottomDock = ({
  activePanel,
  onPanelChange,
  resultTabs,
  activeResultTabId,
  onActiveResultTabChange,
  activeResultTab,
  currentRows,
  totalResultPages,
  resultsPage,
  onResultsPageChange,
  profiling,
  history,
  historyPage,
  historyTotal,
  historyStatusFilter,
  setHistoryStatusFilter,
  historyModelFilter,
  setHistoryModelFilter,
  historyDateFrom,
  setHistoryDateFrom,
  historyDateTo,
  setHistoryDateTo,
  modelOptions,
  onHistoryReRun,
  onHistoryDelete,
  onHistoryPageChange,
  outputEntries,
  onClearOutput,
}: BottomDockProps) => {
  return (
    <div className="sqlwb-bottom-dock">
      <div className="sqlwb-bottom-tabs" role="tablist" aria-label="Workbench panels">
        {panelButtons.map((panel) => (
          <button
            key={panel.id}
            type="button"
            role="tab"
            aria-selected={activePanel === panel.id}
            className={`sqlwb-bottom-tab ${activePanel === panel.id ? 'is-active' : ''}`}
            onClick={() => onPanelChange(panel.id)}
          >
            {panel.label}
          </button>
        ))}
      </div>

      {activePanel === 'results' && (
        <div className="sqlwb-bottom-content">
          <div className="sqlwb-result-tabs">
            {resultTabs.length === 0 && <span className="sqlwb-empty">No result sets yet.</span>}
            {resultTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`sqlwb-result-tab ${tab.id === activeResultTabId ? 'is-active' : ''}`}
                onClick={() => onActiveResultTabChange(tab.id)}
              >
                {tab.title}
              </button>
            ))}
          </div>
          <ResultsGrid
            activeResultTab={activeResultTab}
            currentRows={currentRows}
            totalResultPages={totalResultPages}
            resultsPage={resultsPage}
            onResultsPageChange={onResultsPageChange}
          />
        </div>
      )}

      {activePanel === 'profiling' && (
        <div className="sqlwb-bottom-content">
          <ProfilingGrid profiling={profiling} />
        </div>
      )}

      {activePanel === 'history' && (
        <div className="sqlwb-bottom-content">
          <HistoryGrid
            history={history}
            historyPage={historyPage}
            historyTotal={historyTotal}
            historyStatusFilter={historyStatusFilter}
            setHistoryStatusFilter={setHistoryStatusFilter}
            historyModelFilter={historyModelFilter}
            setHistoryModelFilter={setHistoryModelFilter}
            historyDateFrom={historyDateFrom}
            setHistoryDateFrom={setHistoryDateFrom}
            historyDateTo={historyDateTo}
            setHistoryDateTo={setHistoryDateTo}
            modelOptions={modelOptions}
            onReRun={onHistoryReRun}
            onDelete={onHistoryDelete}
            onPageChange={onHistoryPageChange}
          />
        </div>
      )}

      {activePanel === 'output' && (
        <div className="sqlwb-bottom-content">
          <OutputPanel entries={outputEntries} onClear={onClearOutput} />
        </div>
      )}
    </div>
  )
}
