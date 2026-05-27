let seed: Buffer | null = null;

export const setSeed = (s: Buffer) => seed = s;
export const getSeed = () => seed;
export const wipeSeed = () => seed = null;
