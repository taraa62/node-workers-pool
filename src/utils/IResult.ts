export interface Result<T = undefined> {
    error?: string | Error;
    code?: number;
    success?: boolean;
    message?: string;
    data?: T;
}

export class IResult {
    public static get success(): Result {
        return {success: true} as Result;
    }

    public static successData<T>(data: T): Result<T> {
        return {success: true, data} as Result<T>;
    }

    public static successMess(message: string): Result {
        return {success: true, message} as Result;
    }

    public static successDataMess<T>(data: T, message?: string): Result<T> {
        return {success: true, message, data} as Result<T>;
    }

    public static error(e: Error | string, code?: number): Result {
        const error = (typeof e === "string") ? new Error(e) : e
        return {error, code, message: error.message} as Result;
    }

    public static errorMsg(message: string, e?: Error, code?: number): Result {
        return {error: new Error(message), message, code} as Result;
    }
}
