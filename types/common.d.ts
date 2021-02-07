import {WorkerOptions} from "worker_threads";
import {ECommandType, TWorkerKey} from "./controller";

export type TAnyObject = Record<string, any>
export type TAny<T = unknown> = string | number | boolean | Date | TAnyObject | T;
export type TAnyArray<T> = TAny<T>[];

export const enum EWorkerMode {
    SYNC = 0,
    ASYNC = 1
}

// TODO add new methods.
export interface ILogger {
    info: (message: string) => void;
    error: (error: string | Error) => void;
    verbose: (message: string) => void;
    warning: (message: string) => void;
}

export interface IServiceOptions {
    workersFolder?: string;  // */**/*.worker.js
    logger?: ILogger;        // set default logger for workers pool
}

export interface IPoolOptions {
    name: string;
    mode: EWorkerMode;
    handlers?: string[]; // список імен воркерів які будуть оброблятись кожним воркером, якщо не описано, тоді всі які будуть знайдені
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
    default?: WorkerOptions
    isResetWorker?: boolean; // default:true, if the worker falls, controller will raise a new.
    maxTaskAsync?: number;
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
    tasks: Record<string, number>;
    workerKeyMinTasks?: TWorkerKey
    workerMinTasks: number;
}



