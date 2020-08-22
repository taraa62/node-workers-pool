import {IWorkerMessage, TMessageWorkerBaseReq} from "../../types/worker/worker";

export const enum EWorkerMode {
    SYNC = 0,
    ASYNC = 1
}

export const enum EWorkerMessageType {
    INIT,
}

export type TListenerEvent =
    'online'
    | 'message'
    | 'error'
    | 'exit'


export class WorkerMessage implements IWorkerMessage {
    constructor(public key: string, public type: EWorkerMessageType, public data: TMessageWorkerBaseReq) {
    }
}

