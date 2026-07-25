
//socket.io response
export interface ClientToServerJoining {
    'join-room': (incidentId: number) => void
}