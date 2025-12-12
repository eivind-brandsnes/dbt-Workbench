import { api } from '../api/client'
import { Environment, EnvironmentCreate, EnvironmentUpdate } from '../types'

export const EnvironmentService = {
  list: async (): Promise<Environment[]> => {
    const response = await api.get<Environment[]>('/schedules/environments')
    return response.data
  },

  get: async (id: number): Promise<Environment> => {
    const response = await api.get<Environment>(`/schedules/environments/${id}`)
    return response.data
  },

  create: async (environment: EnvironmentCreate): Promise<Environment> => {
    const response = await api.post<Environment>('/schedules/environments', environment)
    return response.data
  },

  update: async (id: number, environment: EnvironmentUpdate): Promise<Environment> => {
    const response = await api.put<Environment>(`/schedules/environments/${id}`, environment)
    return response.data
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/schedules/environments/${id}`)
  },
}
