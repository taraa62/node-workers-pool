export interface Result<T = undefined> {
    error?: string | Error;
    code?: number;
    success?: boolean;
    msg?: string;
    data?: T;
}

export class IResult {
    public static get success(): Result {
        return {success: true} as Result;
    }

    public static successData(data: any): Result {
        return {success: true, data} as Result;
    }

    public static successMess(message: string): Result {
        return {success: true, message} as Result;
    }

    public static successDataMess<T>(data: T, message: string): Result<T> {
        return {success: true, message, data} as Result;
    }

    public static error(e: Error | string, code?: number): Result {
        return {error: e, code: code} as Result;
    }

    public static errorMsg(message: string, e?: Error, code?: number): Result {
        return {error: e, message, code} as Result;
    }
}
