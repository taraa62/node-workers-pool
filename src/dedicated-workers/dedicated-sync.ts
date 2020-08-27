import {AbstractDedicatedWorker} from "../worker/worker/abstract-dedicated-worker";
import {IDedicatedWorker, IWorkerMessageRequest} from "../../worker";

export class DedicatedSync extends AbstractDedicatedWorker implements IDedicatedWorker {

    public initWorker(initData: IWorkerMessageRequest): void {
        this.logger.info('WORKER: initData - ' + JSON.stringify(initData));
    }

    public runTask(mess: IWorkerMessageRequest): void {
        this.logger.info('WORKER: taskData - ' + JSON.stringify(mess.data));
        setTimeout(() => {

            this.sendSuccessTask(mess, mess.data)
        }, 1500)
    }
}

new DedicatedSync();
