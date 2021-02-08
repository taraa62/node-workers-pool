import {EWorkerMode, ILogger} from "../../types/common";
import {parentPort, workerData} from "worker_threads";
import {ECommandType, EMessageSender, EResponseType, IMessageRequest} from "../../types/controller";
import {MessageRequest, MessageResponse} from "../task";
import {IItemWorkerOptions, IWorkerData} from "../../types/worker";

/*
потрібно обробку для скидання задачі
 */
class WorkerOptions {
    public mode: EWorkerMode = EWorkerMode.SYNC;
    public options?: IItemWorkerOptions
    public isRun = false;
    public isActive = false;
    public isClose = false;


    public exit() {
        this.isActive = false;
        this.isClose = true;
    }

    public runTask() {
        this.isRun = true;
    }

    public endRunTask() {
        if (this.mode === EWorkerMode.SYNC) {
            this.isRun = false
        }
    }
}

export class Logger implements ILogger {
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

const handleDefParams = {
    logger: new Logger()
}

class AbstractWorker {

    private opt = new WorkerOptions();
    private handlers: Record<string, any> = {};
    private requests: Map<string, MessageRequest> = new Map<string, MessageRequest>();


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
        this.opt.mode = workerInitData.mode || EWorkerMode.SYNC;
        this.opt.options = workerInitData.options;

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

    private async run(req: IMessageRequest) {
        if (this.opt.isActive) {
            if (this.opt.mode === EWorkerMode.SYNC) {
                if (this.opt.isRun) return this.sendError(req, new Error('Sink worker is run'), EMessageSender.WORKER, EResponseType.WORKER_RUN);
            } else {
                if (this.requests.size > this.opt.options!.maxTaskAsync) {
                    return this.sendError(req, new Error('Tasks overflow'), EMessageSender.WORKER, EResponseType.WORKER_RUN);
                }
            }
            try {
                switch (req.command) {
                    case ECommandType.INIT:

                        break;
                    case ECommandType.RUN:
                        if (this.handlers[req.handler]) {
                            this.opt.runTask();

                            const handler = this.handlers[req.handler];
                            let func: Function;
                            if (handler.constructor.name === 'Function') {
                                func = handler;
                            } else {
                                func = handler[req.execute!];
                            }
                            if (func) {
                                let res = func.apply(handleDefParams, req.params);
                                if (res.constructor.name === 'Promise') {
                                    res = await res;
                                }
                                this.sendSuccess(req, EMessageSender.HANDLER, res);
                            } else {
                                this.sendError(req, new Error('Function not found'), EMessageSender.WORKER);
                            }
                            this.opt.endRunTask();
                        } else {
                            this.sendError(req, new Error('Handler not found'), EMessageSender.WORKER);
                        }
                        break;
                    case ECommandType.ABORT:
                        // TODO what do you do?
                        // this.sendSuccess(req, EMessageSender.HANDLER, res);
                        break;
                    case ECommandType.CLOSE:
                        this.destroy(0);
                        break;

                }


            } catch (e) {
                this.sendError(req, e, EMessageSender.WORKER, EResponseType.ERROR);
            }

        } else {
            this.sendCriticalError(new Error('Worker is not active'));
        }
    }

    private sendToParent(mess: MessageResponse) {
        console.log(mess);
        parentPort?.postMessage(mess);
    }

    private sendSuccess(req: IMessageRequest, sender: EMessageSender, data: unknown) {
        console.table(data);
        this.sendToParent(new MessageResponse(req.key, EResponseType.SUCCESS, sender, data))
    }

    private sendError(req: IMessageRequest, error: Error, sender: EMessageSender, errorType?: EResponseType): void {
        const mess = `Error called method: ${req.execute} to: ${req.sender} with params: ${
            JSON.stringify(req.params)}, message: ${error?.message}`
        this.sendToParent(new MessageResponse(req.key, EResponseType.ERROR, sender, {
            code: errorType || EResponseType.ERROR,
            message: mess,
            stack: error.stack
        }));
    }

    private sendCriticalError(error: Error): void {
        this.destroy(EResponseType.CRITICAL_ERROR);
        this.sendToParent(new MessageResponse('worker_critical_error', EResponseType.CRITICAL_ERROR, EMessageSender.WORKER, {
            code: EResponseType.CRITICAL_ERROR,
            message: error.message,
            stack: error.stack
        }));
    }

    private destroy(code: number = 0): void {
        this.opt.exit();
        process.exit(code)
    }

}

new AbstractWorker();



