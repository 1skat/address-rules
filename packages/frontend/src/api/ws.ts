let socket: WebSocket | null = null;

export const connectWs = (token: string) => {
    if (socket && socket.readyState === WebSocket.OPEN) return;

    socket = new WebSocket("ws://localhost:3000");
    if (!token) {
        console.error("no jwt token")
        return;
    }

    if (!socket) {
        console.error("no socket");
        return;
    }

    socket.onopen = () => {
        socket.send(JSON.stringify({
            id: crypto.randomUUID(),
            route: "/auth",
            payload: { token }
        }))
    }
}

