let socket: WebSocket | null = null;

export const connectWs = () => {
    if (socket && socket.readyState === WebSocket.OPEN) return;

    socket = (window as any).ws ?? new WebSocket("ws://localhost:3000");
    if (!socket) {
        console.error("Socket not found")
        return;
    }

    socket.onopen = () => console.log("ws conneceted")
    socket.onmessage = (e) => { console.log("data ", JSON.parse(e.data)) }
    socket.onclose = () => console.log("ws disconnected")
    socket.onerror = (e) => console.log("error", e)
}


