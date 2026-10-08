// incidents.ts — all real. server/src/incidents/routes/*

import { jsonInit, request } from './client';
import type { Incident, Severity } from './types';

export async function listIncidents(): Promise<Incident[]> {
    const { incidents } = await request<{ incidents: Incident[] }>('/incidents');
    return incidents;
}

export async function getIncident(id: number): Promise<Incident> {
    const { incident } = await request<{ incident: Incident }>(`/incidents/${id}`);
    return incident;
}

// org_id, created_by, status are absent on purpose: identity comes from the token, status defaults in the DB
export type CreateIncidentInput = {
    title: string;
    severity: Severity;
    affected_system?: string;
};

export async function createIncident(input: CreateIncidentInput): Promise<Incident> {
    const { incident } = await request<{ incident: Incident }>('/incidents', jsonInit('POST', input));
    return incident;
}

// the only transition the server accepts today — any other status is 400 unsupported_status (resolve.ts)
export async function resolveIncident(id: number): Promise<Incident> {
    const { incident } = await request<{ incident: Incident }>(`/incidents/${id}`, jsonInit('PATCH', { status: 'resolved' }));
    return incident;
}
