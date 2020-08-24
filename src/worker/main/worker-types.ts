import {
    IWorkerMessageRequest,
    IWorkerMessageResponse,
} from "../../types/worker/worker";
import {TAny} from "../../types/global";

export const enum EWorkerMode {
    SYNC = 0,
    ASYNC = 1
}

export const enum EWorkerMessageRequest {
    INIT,
    RUN_TASK,
    CLOSE_WORKER,
}

export const enum EWorkerMessageResponse {
    ERROR,
    SUCCESS,
    LOGGER
}


export const enum EWorkerError {
    INTERNAl_WORKER_ERROR = 1,
    INTERNAL_HANDLER_ERROR = 2,
    WORKER_EXIT = 100,
    WORKER_CLOSE = 100 // user closed worker
}

export class WorkerMessageRequest implements IWorkerMessageRequest {
    constructor(public key: string, public type: EWorkerMessageRequest, public data?: TAny) {
    }
}

export class WorkerMessageResponse implements IWorkerMessageResponse {
    constructor(public key: string, public type: EWorkerMessageResponse, public data?: TAny) {
    }
}

