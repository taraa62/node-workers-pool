import {parentPort, workerData} from "worker_threads";
import {EWorkerMessageRequest, EWorkerMessageResponse, WorkerMessageResponse} from "../main/worker-types";
import {IWorkerMessageRequest} from "../../types/worker/worker";
import {TAny} from "../../types/global";


class DedicatedLogger {
    constructor() {
    }

    public info(message: string) {
        const response = new WorkerMessageResponse('info', EWorkerMessageResponse.LOGGER, message);
        parentPort?.postMessage(response);
    }

    public error(message: string | Error) {
        const response = new WorkerMessageResponse('error', EWorkerMessageResponse.LOGGER, message);
        parentPort?.postMessage(response);
    }
}

export abstract class AbstractDedicatedWorker {

    protected logger: DedicatedLogger = new DedicatedLogger();
    private reset = 0;


    constructor() {
        if (!parentPort) throw new Error('parentPort is undefined!')
        parentPort.on("message", this.newMessage.bind(this));
        this.newMessage((workerData) ? workerData : {type: EWorkerMessageRequest.INIT});

        process.addListener('uncaughtException', (er) => {
            this.sendCriticalError(er)
        })
        process.addListener('unhandledRejection', (er) => {
            this.sendCriticalError(er)
        })
    }

    public initWorker(mess: IWorkerMessageRequest): void {
    }

    public abstract runTask(mess: IWorkerMessageRequest): void;

    public sendSuccessTask(mess: IWorkerMessageRequest, data?: TAny): void {
        const response = new WorkerMessageResponse(mess.key, EWorkerMessageResponse.SUCCESS, data);
        parentPort?.postMessage(response);
    }

    public sendErrorTask(mess: IWorkerMessageRequest, error: Error | string): void {
        const response = new WorkerMessageResponse(mess.key, EWorkerMessageResponse.ERROR, typeof error === "string" ? new Error(error) : error);
        parentPort?.postMessage(response);
    }

    public sendCriticalError(error: Error | any): void {
        const response = new WorkerMessageResponse('error', EWorkerMessageResponse.CRITICAL, typeof error === "string" ? new Error(error) : error);
        parentPort?.postMessage(response);
    }

    protected async newMessage(mess: IWorkerMessageRequest): Promise<TAny> {
        if (mess.data.d === 2 && this.reset < 3) {
            this.reset++;
            throw new Error('Test d:2 Error')
        }

        // try {
        switch (mess.type) {
            case EWorkerMessageRequest.INIT:
                return this.initWorker(mess);
            case EWorkerMessageRequest.RUN_TASK:
                return await this.execFunc(mess);
            case EWorkerMessageRequest.CLOSE_WORKER:
                return process.exit(mess.data.code || 99);
            default:
                this.sendErrorTask(mess, 'Undefined type of WorkerMessageRequest');
        }
        // } catch (er) {
        //     this.sendErrorTask(mess, er);
        // }
    }

    private async execFunc(mess: IWorkerMessageRequest): Promise<TAny> {
        const exec = async (func?: string) => {
            if (!func) return;
            const _f = (this as any)[func];
            if (_f) {
                if (_f.constructor.name == "AsyncFunction") {
                    await (_f.call(this, mess) as Promise<TAny>).catch(er => {
                        this.sendErrorTask(mess, er);
                    })
                } else {
                    _f.call(this, mess);
                }
            }
        }
        await exec('runTask');
        await exec(mess?.execMethod);
    }


}

