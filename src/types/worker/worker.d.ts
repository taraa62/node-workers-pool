import {TAny} from '../global';
import {EWorkerError, EWorkerMessageRequest, EWorkerMessageResponse, EWorkerMode} from "../../worker/main/worker-types";
import {WorkerDedicate} from "../../worker/main/worker-dedicate";

export interface ILogger {
    info: (message: string) => void;
    error: (error: string | Error) => void;
}

export interface IWorkersService {
    addPool(options: IPoolOptions): void;

    addTask<T>(namePool: string, data: TAny): Promise<T>;

    close(namePool: string): void;

}

export interface IPoolOptions {
    name: string;
    minPoolWorkers?: number;
    maxPoolWorkers?: number;
    isUpWorker?: (opt: IPoolOptions, controller: IWorkerPoolController) => boolean;
    maxTaskToUpNewWorker?: number;
    callWorkerExit?: (key: string, error?: Error) => void;
    pathJsFile: string;
    mode: EWorkerMode;
    initData?: TAny;
    timeRunTask?: number;
}

export interface IWorkerPoolController {

    newTask<T>(data: TAny): Promise<T>;

    checkQueueTasks(): void;

    /* [available, up] */
    getAvailableWorkers(): [WorkerDedicate[], WorkerDedicate[]];

    workerExit(key: string, code: number, er?: Error): void;

    destroy(code: EWorkerError): void;

    logger: ILogger;
}

export interface IDedicatedWorker {
    initWorker: (initData: IWorkerMessageRequest) => void;
    runTask: (req: IWorkerMessageRequest) => void;

    sendSuccessTask(mess: IWorkerMessageRequest, error: Error | string): void;

    sendErrorTask(mess: IWorkerMessageRequest, error: Error | string): void;
}

interface IWorkerMessage {
    key: string;
    data?: TAny;
}

export interface IWorkerMessageRequest extends IWorkerMessage {
    type: EWorkerMessageRequest;
    execMethod?: string; // execute some method after execute runTask
}

export interface IWorkerMessageResponse extends IWorkerMessage {
    type: EWorkerMessageResponse;
}
