import { FileTree } from '../../components/FileTree'
import { SqlAutocompleteMetadata } from '../../types'

interface ModelFileNode {
  name: string
  path: string
  type: string
  category?: string | null
}

interface SelectedModelOption {
  id: string
  name: string
  schema?: string | null
  originalFilePath?: string | null
}

interface NavigatorPaneProps {
  metadata: SqlAutocompleteMetadata | null
  modelFiles: ModelFileNode[]
  selectedModelOptions: SelectedModelOption[]
  selectedFilePath: string
  selectedModelId: string
  gitLoadError: string | null
  onRefreshFiles: () => void
  onSelectFile: (path: string) => void
  onSelectModel: (modelId: string, modelName: string, filePath?: string | null) => void
  onRefreshCompiled: () => void
  onSaveFile: () => void
  onReloadFile: () => void
  fileSaveMessage: string
  setFileSaveMessage: (value: string) => void
  fileValidationErrors: string[]
  canSaveFile: boolean
  isSavingFile: boolean
  isReadonly: boolean
  selectedFileExists: boolean
}

export const NavigatorPane = ({
  metadata,
  modelFiles,
  selectedModelOptions,
  selectedFilePath,
  selectedModelId,
  gitLoadError,
  onRefreshFiles,
  onSelectFile,
  onSelectModel,
  onRefreshCompiled,
  onSaveFile,
  onReloadFile,
  fileSaveMessage,
  setFileSaveMessage,
  fileValidationErrors,
  canSaveFile,
  isSavingFile,
  isReadonly,
  selectedFileExists,
}: NavigatorPaneProps) => {
  return (
    <div className="sqlwb-navigator">
      <section className="sqlwb-panel">
        <div className="sqlwb-panel-header">
          <h3>Project Navigator</h3>
          <button type="button" className="sqlwb-link" onClick={onRefreshFiles}>
            Refresh
          </button>
        </div>

        {gitLoadError ? (
          <div className="sqlwb-inline-error">{gitLoadError}</div>
        ) : (
          <div className="sqlwb-tree-wrap">
            <FileTree
              nodes={modelFiles}
              onSelect={onSelectFile}
              selectedPath={selectedFilePath}
              emptyMessage="No model files found."
              storageKey="sql-workspace"
            />
          </div>
        )}

        {selectedFileExists && (
          <div className="sqlwb-file-actions">
            <label htmlFor="sqlwb-save-note">Change note</label>
            <input
              id="sqlwb-save-note"
              value={fileSaveMessage}
              onChange={(event) => setFileSaveMessage(event.target.value)}
              placeholder="Optional commit or change note"
            />
            {fileValidationErrors.length > 0 && (
              <div className="sqlwb-inline-error">
                {fileValidationErrors.map((err) => (
                  <div key={err}>{err}</div>
                ))}
              </div>
            )}
            {isReadonly && <div className="sqlwb-warning-text">This file is read-only.</div>}
            <div className="sqlwb-inline-actions">
              <button
                type="button"
                className="sqlwb-btn sqlwb-btn-primary"
                onClick={onSaveFile}
                disabled={!canSaveFile || isSavingFile || isReadonly}
              >
                {isSavingFile ? 'Saving…' : 'Save file'}
              </button>
              <button type="button" className="sqlwb-btn sqlwb-btn-ghost" onClick={onReloadFile}>
                Reload
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="sqlwb-panel">
        <div className="sqlwb-panel-header">
          <h3>Database Navigator</h3>
        </div>

        <div className="sqlwb-form-field">
          <label htmlFor="sqlwb-model-select">dbt model</label>
          <select
            id="sqlwb-model-select"
            value={selectedModelId}
            onChange={(event) => {
              const modelId = event.target.value
              const match = selectedModelOptions.find((item) => item.id === modelId)
              if (match) {
                onSelectModel(match.id, match.name, match.originalFilePath)
              }
            }}
          >
            <option value="">Select model</option>
            {selectedModelOptions.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name} {model.schema ? `(${model.schema})` : ''}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="sqlwb-btn sqlwb-btn-ghost"
            onClick={onRefreshCompiled}
            disabled={!selectedModelId}
          >
            Refresh compiled SQL
          </button>
        </div>

        <div className="sqlwb-schema-browser">
          {!metadata && <div className="sqlwb-empty">Loading metadata…</div>}
          {metadata &&
            Object.entries(metadata.schemas).map(([schema, relations]) => (
              <div key={schema} className="sqlwb-schema-block">
                <div className="sqlwb-schema-name">{schema}</div>
                <ul>
                  {relations.map((relation) => (
                    <li key={relation.unique_id || relation.relation_name}>
                      <button
                        type="button"
                        className="sqlwb-link"
                        onClick={() => {
                          if (!relation.unique_id) return
                          onSelectModel(relation.unique_id, relation.name, relation.original_file_path)
                        }}
                      >
                        <span>{relation.name}</span>
                        <small>{relation.resource_type}</small>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </div>
      </section>
    </div>
  )
}
