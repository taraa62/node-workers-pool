export enum EMessageSender {
    SERVICE = 0,
    POOL = 1,
    CONTROLLER = 2,
    WORKER = 3,
    HANDLER = 4
}

export enum ECommandType {
    INIT = 0,
    RUN = 1,
    ABORT = 2,
    CLOSE = 3,
}

export enum EResponseType {
    SUCCESS = 3,
    ERROR = 4,
    CRITICAL_ERROR = 5,
    WORKER_RUN = 6,
    LOGGER = 7,
    SERVICE = 8
}

export const getSenderKey = (sender: EMessageSender) => EMessageSender[sender as unknown as keyof typeof EMessageSender];

export const getResponseType = (type: EResponseType) => EResponseType[type as unknown as keyof typeof EResponseType];

export const getCommandType = (type: ECommandType) => ECommandType[type as unknown as keyof typeof ECommandType];
