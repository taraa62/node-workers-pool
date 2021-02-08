import {EWorkerMode, ILogger} from "./common";

export interface IWorkerData {
    mode: EWorkerMode;
    handlers: Record<string, string>;
    options: IItemWorkerOptions;
}

export interface IItemWorkerOptions {
    maxTaskAsync: number,
    timeout: number
}

export interface IHandlerDefParams {
    logger: ILogger
}

export interface IWorker {

}


