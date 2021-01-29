import {EWorkerMode, ILogger} from "../../types/common";
import {parentPort, workerData} from "worker_threads";
import {ECommandType, EMessageSender, EResponseType, IMessageRequest} from "../../types/controller";
import {MessageResponse} from "../task";
import {IWorkerData} from "../../types/worker";

/*
потрібно обробку для скидання задачі
 */
class WorkerOptions {
    public mode: EWorkerMode = EWorkerMode.ASYNC;
    public isRun = false;
    public isActive = false;
    public isClose = false;

    public exit() {
        this.isActive = false;
        this.isClose = true;
    }
    public runTask(){
        this.isRun = true;
    }
    public endRunTask(){
        if(this.mode === EWorkerMode.SYNC){
            this.isRun = false
        }
    }
}

class Logger implements ILogger {
    error(error: string | Error): void {
        const response = new MessageResponse('error', EResponseType.LOGGER, EMessageSender.WORKER, error);
        parentPort?.postMessage(response);
    }

    info(message: string): void {
        const response = new MessageResponse('info', EResponseType.LOGGER, EMessageSender.WORKER, message);
        parentPort?.postMessage(response);
    }

    verbose(message: string): void {
        const response = new MessageResponse('verbose', EResponseType.LOGGER, EMessageSender.WORKER, message);
        parentPort?.postMessage(response);
    }

    warning(message: string): void {
        const response = new MessageResponse('warning', EResponseType.LOGGER, EMessageSender.WORKER, message);
        parentPort?.postMessage(response);
    }

}
// @ts-ignore
const handleWrapper = {
    logger:new Logger()
}

class AbstractWorker {

    private opt = new WorkerOptions();
    private handlers: Record<string, any> = {};


    constructor() {
        this.opt.isActive = true;
        if (!parentPort) throw new Error('parentPort is undefined!')
        parentPort.on("message", this.run.bind(this));

        const errorEvents = ['rejectionHandled', 'uncaughtException', 'uncaughtExceptionMonitor', 'unhandledRejection'];
        errorEvents.forEach(v => process.addListener(v as any, (er?: Error) => this.sendCriticalError(er || new Error('unhandled rejection'))))
        this.init().catch(er => this.sendCriticalError(er));
    }

    private async init() {
        const workerInitData: IWorkerData = workerData;
        if (!workerInitData) {
            this.sendCriticalError(new Error('workerData not found'));
        }
        this.opt.mode = workerInitData.mode || EWorkerMode.ASYNC;

        const entryHandlers = Object.entries(workerInitData.handlers);
        for (const [key, path] of entryHandlers) {
            if (key && path) {
                this.handlers[key] = await require(path);
            }
        }
        if (!Object.keys(this.handlers).length) {
            this.sendCriticalError(new Error('The list of handlers is empty'))
        }
    }

    private run(req: IMessageRequest) {
        if(this.opt.isActive){
            if(this.opt.mode === EWorkerMode.SYNC && this.opt.isRun){
                return this.sendError(req, new Error('Sink worker is run'), EMessageSender.WORKER, EResponseType.WORKER_RUN);
            }


            try {
                switch (req.command) {
                    case ECommandType.INIT:

                        break;
                    case ECommandType.RUN:
                        if(this.handlers[req.handler]){
                            this.opt.runTask();
                            console.log(this.handlers)

                            this.opt.endRunTask();
                        }else {
                            this.sendError(req, new Error('Handler not found'), EMessageSender.WORKER);
                        }
                                               break;
                    case ECommandType.ABORT:

                        break;
                    case ECommandType.CLOSE:

                        break;

                }


            }catch (e) {
                this.sendError(req, e, EMessageSender.WORKER, EResponseType.ERROR);
            }

        }else {
            this.sendCriticalError(new Error('Worker is not active'));
        }
    }

    private sendToParent(mess: MessageResponse) {
        parentPort?.postMessage(mess);
    }

    public sendError(req: IMessageRequest, error: Error, sender: EMessageSender, errorType?: EResponseType): void {
        const mess = `Error called method: ${req.execute} to: ${req.sender} with params: ${
            JSON.stringify(req.params)}, message: ${error?.message}`
        this.sendToParent(new MessageResponse(req.key, EResponseType.ERROR, sender, {
            code: errorType || EResponseType.ERROR,
            message: mess,
            stack: error.stack
        }));
    }

    private sendCriticalError(error: Error): void {
        this.opt.exit();
        this.sendToParent(new MessageResponse('worker_critical_error', EResponseType.CRITICAL_ERROR, EMessageSender.WORKER, {
            code: EResponseType.CRITICAL_ERROR,
            message: error.message,
            stack: error.stack
        }));
    }


}

new AbstractWorker();



