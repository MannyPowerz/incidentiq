//centrailizing function to to distingusih room name to prevent any mismatch when declaring within connection
//this prevents joining and emitting from drifting apart.
export function formatRoomName(incidentId: number) {
    return `Incident-${incidentId}`
}