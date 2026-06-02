export const throttle = (fn: Function, ms: number) => {
    let last = 0;
    return (...args: any[]) => {
        const now = Date.now();
        if (now - last >= ms) {
            last = now
            fn(...args);
        }
    }
}
