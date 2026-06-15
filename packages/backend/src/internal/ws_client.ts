const userWsConns = new Map<string, WebSocket>();

export const wsClient = {
    register: (userId: string, ws: WebSocket) => {
        const existing = userWsConns.get(userId);
        if (existing) {
            existing.close()
        }
        userWsConns.set(userId, ws);
    },
    remove: (userId: string) => userWsConns.delete(userId),
    get: (userId: string) => userWsConns.get(userId),
    send: (userId: string, data: object) => {
        userWsConns.get(userId)?.send(JSON.stringify(data))
    }
}
