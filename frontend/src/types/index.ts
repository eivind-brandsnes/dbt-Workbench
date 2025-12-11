export interface HealthResponse {
  status: string
  backend: string
  version: string
}

export interface Run {
  id: number;
  run_id: string;
  command: string;
  timestamp: string;
  status: string;
  summary: any;
}

export interface Model {
  id: number;
  unique_id: string;
  name: string;
  schema_: string;
  database: string;
  resource_type: string;
  columns: any;
  checksum: string;
  timestamp: string;
  run_id: number;
}

export interface ModelDiff {
  structural_diff: {
    added: any[];
    removed: any[];
    changed: any[];
  };
  metadata_diff: {
    description: { from: string; to: string };
    tags: { from: string[]; to: string[] };
    tests: { from: any[]; to: any[] };
  };
  checksum_diff: {
    from: string;
    to: string;
  };
}

export interface ArtifactSummary {
  manifest: boolean
  run_results: boolean
  catalog: boolean
}

export interface ModelSummary {
  unique_id: string
  name: string
  resource_type: string
  depends_on: string[]
  database?: string
  schema?: string
  alias?: string
  tags?: string[]
}

export interface ModelDetail extends ModelSummary {
  description?: string
  columns: Record<string, { name?: string; description?: string; type?: string }>
  children: string[]
  tags?: string[]
}

export interface LineageNode {
  id: string
  label: string
  type: string
  database?: string
  schema?: string
  tags?: string[]
}

export interface LineageEdge {
  source: string
  target: string
}

export interface LineageGraph {
  nodes: LineageNode[]
  edges: LineageEdge[]
  groups?: LineageGroup[]
}

export interface LineageGroup {
  id: string
  label: string
  type: string
  members: string[]
}

export interface ColumnNode {
  id: string
  column: string
  model_id: string
  label: string
  type: string
  database?: string
  schema?: string
  tags?: string[]
  data_type?: string
  description?: string
}

export interface ColumnLineageEdge extends LineageEdge {
  source_column: string
  target_column: string
}

export interface ColumnLineageGraph {
  nodes: ColumnNode[]
  edges: ColumnLineageEdge[]
}

export interface ImpactResponse {
  upstream: string[]
  downstream: string[]
}

export interface RunRecord {
  status?: string
  start_time?: string
  end_time?: string
  duration?: number
  invocation_id?: string
  model_unique_id?: string
}

export interface ArtifactVersionInfo {
  current_version: number
  timestamp: string | null
  checksum: string | null
  available_versions: number[]
  status: {
    healthy: boolean
    last_error: string | null
    last_check: string | null
  }
}

export interface VersionCheckResponse {
  updates_available: Record<string, boolean>
  any_updates: boolean
  current_versions: Record<string, number>
  version_info: Record<string, ArtifactVersionInfo>
}

// Execution types
export type RunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
export type DbtCommand = 'run' | 'test' | 'seed' | 'docs generate';

export interface RunRequest {
  command: DbtCommand;
  parameters?: Record<string, any>;
  description?: string;
}

export interface RunSummary {
  run_id: string;
  command: DbtCommand;
  status: RunStatus;
  start_time: string;
  end_time?: string;
  duration_seconds?: number;
  description?: string;
  error_message?: string;
  artifacts_available: boolean;
}

export interface RunDetail extends RunSummary {
  parameters: Record<string, any>;
  log_lines: string[];
  artifacts_path?: string;
  dbt_output?: Record<string, any>;
}

export interface LogMessage {
  run_id: string;
  timestamp: string;
  level: string;
  message: string;
  line_number: number;
}

export interface RunHistoryResponse {
  runs: RunSummary[];
  total_count: number;
  page: number;
  page_size: number;
}

export interface ArtifactInfo {
  filename: string;
  size_bytes: number;
  last_modified: string;
  checksum: string;
}

export interface RunArtifactsResponse {
  run_id: string;
  artifacts: ArtifactInfo[];
  artifacts_path: string;
}
