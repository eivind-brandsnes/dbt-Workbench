import { api } from '../api/client'
import {
  RowLineageExportRequest,
  RowLineageExportResponse,
  RowLineageModelsResponse,
  RowLineagePreviewRequest,
  RowLineagePreviewResponse,
  RowLineageStatus,
  RowLineageTraceResponse,
} from '../types'

export class RowLineageService {
  static async getStatus(): Promise<RowLineageStatus> {
    const response = await api.get<RowLineageStatus>('/row-lineage/status')
    return response.data
  }

  static async listModels(): Promise<RowLineageModelsResponse> {
    const response = await api.get<RowLineageModelsResponse>('/row-lineage/models')
    return response.data
  }

  static async exportMappings(payload: RowLineageExportRequest): Promise<RowLineageExportResponse> {
    const response = await api.post<RowLineageExportResponse>('/row-lineage/export', payload)
    return response.data
  }

  static async previewModel(payload: RowLineagePreviewRequest): Promise<RowLineagePreviewResponse> {
    const response = await api.post<RowLineagePreviewResponse>('/row-lineage/preview', payload)
    return response.data
  }

  static async getTrace(
    modelUniqueId: string,
    traceId: string,
    params?: { environment_id?: number; max_hops?: number },
  ): Promise<RowLineageTraceResponse> {
    const response = await api.get<RowLineageTraceResponse>(
      `/row-lineage/trace/${encodeURIComponent(modelUniqueId)}/${encodeURIComponent(traceId)}`,
      { params },
    )
    return response.data
  }
}
