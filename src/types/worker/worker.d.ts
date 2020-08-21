import {TAny, TAnyObject} from '../global';

export interface IWorkersService {
    addPool(options: IPoolOptions): void;

    addTask(namePool: string, data: TAny): void;
}

export enum EModeThread {
    SINGLE = 0,
    MULTI = 1
}

export interface IPoolOptions {
    mode: EModeThread;
    name: string;
    pathJsFile: string;
    workerOption: IWorkerOption;
    initData: TAnyObject;
    minWorkers: number;
    maxWorkers: number;
    timeRunTask: number;
}

export interface IWorkerOption {
    isMessageChannel: boolean;
}

export interface IWorkerPoolController {

    newTask(data: TAny): string;

    workerEndRun(key: string): void;

    workerDead(key: string, er: number | string | Error): void;

}
