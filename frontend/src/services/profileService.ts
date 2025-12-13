import { api } from '../api/client';

export interface ProfileInfo {
    name: string;
    targets: string[];
}

export interface ProfilesResponse {
    content: string;
    profiles: ProfileInfo[];
}

export interface ProfileContent {
    content: string;
}

export const ProfileService = {
    get: async (): Promise<ProfilesResponse> => {
        const response = await api.get<ProfilesResponse>('/profiles');
        return response.data;
    },

    update: async (content: string): Promise<ProfilesResponse> => {
        const response = await api.put<ProfilesResponse>('/profiles', { content });
        return response.data;
    },
};
