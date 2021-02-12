import {EWorkerMode, EWorkerType, ILogger} from "./common";
import {TWorkerKey} from "./controller";

export interface IItemWorkerOptions {
    mode: EWorkerMode;
    type: EWorkerType;
    handlers: Record<string, string>;
    maxTaskAsync: number,
    timeout: number,
    controllerKey: TWorkerKey
}
export interface IWorkerHandler {
    logger: ILogger;
    controllerKey: TWorkerKey,
    workerKey: TWorkerKey
}

export interface IWorker {

}


