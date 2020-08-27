import {
    EWorkerMessageRequest,
    EWorkerMessageResponse,
    IWorkerMessageRequest,
    IWorkerMessageResponse,
    TAny
} from "../../../worker";


export class WorkerMessageRequest implements IWorkerMessageRequest {
    constructor(public key: string, public type: EWorkerMessageRequest, public data?: TAny) {
    }
}

export class WorkerMessageResponse implements IWorkerMessageResponse {
    constructor(public key: string, public type: EWorkerMessageResponse, public data?: TAny) {
    }
}

