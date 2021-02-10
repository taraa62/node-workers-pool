import {EWorkerMode, ILogger} from "./common";
import {TWorkerKey} from "./controller";

export interface IWorkerData {
    mode: EWorkerMode;
    handlers: Record<string, string>;
    options: IItemWorkerOptions;
}

export interface IItemWorkerOptions {
    maxTaskAsync: number,
    timeout: number,
    controllerKey: TWorkerKey
}

export interface IWorkerHandler {
    logger: ILogger
}

export interface IWorker {

}


