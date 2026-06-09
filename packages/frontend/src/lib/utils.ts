export const generateIndecies = () => {
    const out: Array<number> = [];
    while (out.length !== 3) {
        const idx = Math.floor(Math.random() * 12);
        if (out.includes(idx)) continue;

        out.push(idx)
    }
    return out;
}

