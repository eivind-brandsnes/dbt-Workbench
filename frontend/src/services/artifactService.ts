import { SeedWarningStatus } from '../types'
import { api } from '../api/client'

export class ArtifactService {
  static async getSeedStatus(): Promise<SeedWarningStatus> {
    const response = await api.get<SeedWarningStatus>('/artifacts/seed-status')
    return response.data
  }
}
