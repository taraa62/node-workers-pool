import {WorkerOptions} from "worker_threads";
import {TWorkerKey} from "./controller";
import {ECommandType} from "../src/common";
import {ForkOptions} from "child_process";

export type TAnyObject = Record<string, any>
export type TAny<T = unknown> = string | number | boolean | Date | TAnyObject | T;
export type TAnyArray<T> = TAny<T>[];

export const enum EWorkerMode {
    SYNC = 0,
    ASYNC = 1
}

export const enum EWorkerType {
    THREADS = 0,
    FORK = 1,
    // CLUSTER = 2,
    // SPAWN = 3
}

export interface ILogger {
    info: (message: unknown) => void;
    warn: (message: unknown) => void;
    error: (error: Error) => void;
    verbose: (mess: unknown) => void;
}

export interface IServiceOptions {
    workersFolder?: string;  // */**/*.worker.js
    logger?: ILogger;        // set default logger for workers pool
}

export interface IPoolOptions {
    name: string;
    handlers: string[]; // the names of the files to be used as a handler, without extension (handler.worker)
    mode?: EWorkerMode;
    type?: EWorkerType
    minWorkers?: number; // it can be between 1-5
    maxWorkers?: number; // it can be between minWorkers-10
    workerOpt?: IWorkerOptions;
    taskOpt?: ITaskOptions;

    dropPool?(): void; // if isResetWorker = undefined | false and were critical errors, worker doesn't kill from list activities workers. Next step -> drop pool,  all task will execute with error result
    isUpWorker?(opt: IPoolOptions, poolInfo: {
        awaitTasks: number,
        info: ICommonWorkerStatus;
    }): boolean;
}

export interface IWorkerOptions {
    default?: WorkerOptions | ForkOptions
    maxTaskAsync?: number;
    isErrorCritical?(error:Error):boolean;
}

export interface ITaskOptions {
    maxRunAttempts?: number;
    /**
     * default = 0; -newer reset if the task throw an error.
     */
    timeout?: number;
}

export type IError = Error | string | number | ECommandType

export interface ICommonWorkerStatus {
    active: number; //num workers are with status online+up+run
    online: number; // if worker is normal work
    up: number;     // if worker is up
    run: number;    // if worker is do something
    stop: number;   // if worker stop or down
    tasks: Record<string, [number, boolean]>; // workerKey, [totalTasks, isOnlineWorker]
    workerKeyMinTasks?: TWorkerKey
    workerMinTasks: number;
}



