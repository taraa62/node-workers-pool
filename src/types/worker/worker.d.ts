import {TAny} from '../global';
import {EWorkerError, EWorkerMessageRequest, EWorkerMessageResponse, EWorkerMode} from "../../worker/main/worker-types";
import {WorkerDedicated} from "../../worker/main/worker-dedicated";
import {WorkerTask} from "../../worker/main/worker-task";

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
    dropPool?: () => void; // if isResetWorker = undefined | false and were critical errors, worker doesn't kill from list activities workers. Next step -> drop pool,  all task will execute with error result
    maxTaskToUpNewWorker?: number;
    pathJsFile: string;
    mode: EWorkerMode;
    initData?: TAny;
    timeRunTask?: number;
    isResetWorker?:boolean; // default:true, if the worker falls, controller will raise a new.
    maxResetTask?:number; // default = -1; -newer reset if the task throw an error.
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
