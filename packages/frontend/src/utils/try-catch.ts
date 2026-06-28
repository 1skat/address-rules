type Branded<T> = T & { __tryCatchTupleResult: never };
type DisableArrayMethods<T> = T & {
    [K in Exclude<keyof Array<any>, "length" | symbol>]: never;
};

type DataErrorTuple<T, E> = Branded<
    DisableArrayMethods<[data: T, err: E] & never[]>
>;

export type Success<T> = DataErrorTuple<T, null>;
export type Failure<E extends Error> = DataErrorTuple<null, E | Error>;
export type Result<T, E extends Error> = Success<T> | Failure<E>;

// Functions that return Result:
type TryCatchFunc<E_ extends Error = Error> = <T, E extends Error = E_>(
    fn: T | (() => T),
    operationName?: string,
) => Result<T, E>;

type TryCatchAsyncFunc<E_ extends Error = Error> = <T, E extends Error = E_>(
    fn: Promise<T> | (() => Promise<T>),
    operationName?: string,
) => Promise<Result<T, E>>;


// Export handlers:
export const tryCatch: TryCatchFunc = <T, E extends Error = Error>(
    fn: T | (() => T),
    operationName?: string,
): Result<T, E> => {
    try {
        const res = typeof fn === "function" ? (fn as () => T)() : fn
        return [res, null] as Result<T, E>
    } catch (rawError) {
        return handleError(rawError, operationName);
    }
}

export const tryCatchAsync: TryCatchAsyncFunc = async <T, E extends Error = Error>(
    fn: Promise<T> | (() => Promise<T>),
    operationName?: string,
): Promise<Result<T, E>> => {
    try {
        const promise = typeof fn === "function" ? fn() : fn
        const res = await promise
        return [res, null] as Result<Awaited<T>, E>
    } catch (rawError) {
        return handleError(rawError, operationName)
    }
}

function handleError(rawError: unknown, operationName?: string) {
    const processedError =
        rawError instanceof Error
            ? rawError
            : new Error(String(rawError), { cause: rawError });

    if (operationName) {
        processedError.message = `Operation "${operationName}" failed: ${processedError.message}`;
    }

    return [null, processedError] as Failure<typeof processedError>;
}
