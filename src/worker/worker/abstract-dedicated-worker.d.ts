import {IWorkerMessageRequest, TAny} from "../../../types/worker";

export declare class DedicatedLogger {
    info(message: string): void;

    error(message: string | Error): void;
}

export declare class AbstractDedicatedWorker {
    constructor();

    readonly logger: DedicatedLogger;

    runTask(mess: IWorkerMessageRequest): void;

    initWorker(mess: IWorkerMessageRequest): void;

    sendSuccessTask(mess: IWorkerMessageRequest, data?: TAny): void;

    sendErrorTask(mess: IWorkerMessageRequest, error: Error | string): void;

    sendCriticalError(error: Error | TAny): void;
}
