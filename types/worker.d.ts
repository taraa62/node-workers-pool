import {WorkerDedicated} from "../src/worker/main/worker-dedicated";
import {WorkerTask} from "../src/worker/main/worker-task";


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
    CRITICAL,
    SUCCESS,
    LOGGER
}

export const enum EWorkerError {
    INTERNAl_WORKER_ERROR = 1,
    INTERNAL_HANDLER_ERROR = 2,
    WORKER_EXIT = 100,
    WORKER_CLOSE = 100 // user closed worker
}

export interface ILogger {
    info(message: string): void;

    error(error: string | Error): void;
}

interface IWorkerService {
    addPool(options: IPoolOptions): void;

    addTask<T>(namePool: string, data: TAny): Promise<T>;

    close(namePool: string): void;
}


export type TAnyObject = Record<string, any>
export type TAny<T = any> = string | number | boolean | TAnyObject | T;

export declare class WorkerService implements IWorkerService {
    constructor();

    addPool(options: IPoolOptions): void;

    addTask<T>(namePool: string, data: TAny): Promise<T>;

    close(namePool: string): void;
}


export interface IPoolOptions {
    name: string;
    minPoolWorkers?: number;
    maxPoolWorkers?: number;
    maxTaskToUpNewWorker?: number;
    pathJsFile: string;
    mode: EWorkerMode;
    initData?: TAny;
    timeRunTask?: number;
    isResetWorker?: boolean; // default:true, if the worker falls, controller will raise a new.
    maxResetTask?: number; // default = -1; -newer reset if the task throw an error.

    isUpWorker?(opt: IPoolOptions, controller: IWorkerPoolController): boolean;
    dropPool?(): void; // if isResetWorker = undefined | false and were critical errors, worker doesn't kill from list activities workers. Next step -> drop pool,  all task will execute with error result
}

export interface IWorkerPoolController {

    newTask<T>(data: TAny): Promise<T>;

    checkQueueTasks(): void;

    /* [available, up] */
    getAvailableWorkers(): [available: number, up: number, run: number, stop: number];

    closeWorker(worker: WorkerDedicated, tasks: Map<string, WorkerTask>): void;

    destroy(code: EWorkerError): void;

    logger: ILogger;
}

export interface IDedicatedLogger {
    info(message: string): void;

    error(message: string | Error): void;
}

export interface IDedicatedWorker {

    logger: IDedicatedLogger

    initWorker(initData: IWorkerMessageRequest): void;

    runTask(req: IWorkerMessageRequest): void;

    sendSuccessTask(mess: IWorkerMessageRequest, data?: TAny): void;

    sendErrorTask(mess: IWorkerMessageRequest, error: Error | string): void;

    sendCriticalError(error: Error | TAny): void
}


declare class AbstractDedicatedWorker implements IDedicatedWorker {
    constructor();

    readonly logger: IDedicatedLogger

    initWorker(initData: IWorkerMessageRequest): void;

    runTask(req: IWorkerMessageRequest): void;

    sendSuccessTask(mess: IWorkerMessageRequest, data?: TAny): void;

    sendErrorTask(mess: IWorkerMessageRequest, error: Error | string): void;

    sendCriticalError(error: Error | TAny): void;
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
