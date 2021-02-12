import {ILogger} from "../types/common";

export const DefWorkerLogger: ILogger = {
    error: console.error,
    info: console.info,
    verbose: console.log,
    warn: console.info
}


export enum EMessageSender {
    SERVICE = 0,
    POOL = 1,
    CONTROLLER = 2,
    WORKER = 3,
    HANDLER = 4
}

export enum ECommandType {
    UP = 9,
    INIT = 10,
    RUN = 11,
    ABORT_TASK = 12,  // for future
    CLOSE_WORKER = 19,  // worker.terminate()
 }

export enum EResponseType {
    SUCCESS = 100,
    ERROR = 101,
    CRITICAL_ERROR = 102,  // worker.exit(ECommandType.CRITICAL_ERROR)

    LOGGER = 110,
    SERVICE = 120
}

export const getSenderKey = (sender: EMessageSender) => EMessageSender[sender as unknown as keyof typeof EMessageSender];

export const getResponseType = (type: EResponseType) => EResponseType[type as unknown as keyof typeof EResponseType];

export const getCommandType = (type: ECommandType) => ECommandType[type as unknown as keyof typeof ECommandType];
