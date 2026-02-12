import { SqlEditorTab } from './types'

interface EditorTabsProps {
  tabs: SqlEditorTab[]
  activeTabId: string
  onSelectTab: (tabId: string) => void
  onCloseTab: (tabId: string) => void
  onAddTab: () => void
}

export const EditorTabs = ({ tabs, activeTabId, onSelectTab, onCloseTab, onAddTab }: EditorTabsProps) => {
  return (
    <div className="sqlwb-editor-tabs" aria-label="SQL editor tabs">
      <div className="sqlwb-editor-tab-list" role="tablist" aria-label="Open SQL tabs">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId
          return (
            <div key={tab.id} className={`sqlwb-editor-tab ${isActive ? 'is-active' : ''}`} role="presentation">
              <button
                type="button"
                role="tab"
                aria-selected={isActive}
                className="sqlwb-editor-tab-button"
                onClick={() => onSelectTab(tab.id)}
                title={tab.sourceFilePath || tab.title}
              >
                <span className="sqlwb-editor-tab-title">{tab.title}</span>
                {tab.isDirty && <span className="sqlwb-editor-tab-dirty" aria-hidden>●</span>}
              </button>
              <button
                type="button"
                className="sqlwb-editor-tab-close"
                onClick={() => onCloseTab(tab.id)}
                aria-label={`Close ${tab.title}`}
              >
                ×
              </button>
            </div>
          )
        })}
      </div>
      <button
        type="button"
        className="sqlwb-tab-plus"
        onClick={onAddTab}
        aria-label="Open a new SQL tab"
      >
        +
      </button>
    </div>
  )
}
