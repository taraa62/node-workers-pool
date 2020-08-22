import {TAny} from '../global';
import {EWorkerMessageType, EWorkerMode} from "../../worker/worker/worker-types";
import {WorkerDedicate} from "../../worker/worker/worker-dedicate";
import {MessagePort} from "worker_threads";
import {IncomingHttpHeaders} from "http";
import {IResult, Result} from "../../utils/IResult";

export interface IWorkersService {
    addPool(options: IPoolOptions): void;

    addTask(namePool: string, data: TAny): void;
}

export interface IPoolOptions {
    name: string;
    pathJsFile: string;
    mode: EWorkerMode;
    initData?: TAny;
    minPoolWorkers?: number;
    maxPoolWorkers?: number;
    timeRunTask?: number;
    isUpWorker?: (opt: IPoolOptions, controller: IWorkerPoolController) => boolean;
    maxTaskToUpNewWorker?: number;
    callWorkerExit?: (key: string, error?: Error) => void;
}


export interface IWorkerPoolController {

    newTask<T>(data: TAny): Promise<Result<T>>;

    getAvailableWorkers(): WorkerDedicate[];

    workerExit(key: string, code: number, er?: Error): void;

}

export interface IWorkerData {
    data?: TAny;
}

export type TMessageWorkerBaseReq = {
    command: string
}
export type TMessageWorkerBaseResp = {
    error?: Error | Result | string
    respHeaders?: IncomingHttpHeaders;

}

export interface IWorkerMessage {
    key: string;
    type: EWorkerMessageType;
    data: TMessageWorkerBaseReq;
    dataArr?: Array<TAny>
    isRequestEnd?: boolean;
}
