import {EWorkerMode, ILogger, TAny, TAnyObject} from "../../types/common";
import {parentPort, workerData} from "worker_threads";
import {IMessageRequest, TTaskKey} from "../../types/controller";
import {MessageRequest, MessageResponse} from "../task";
import {IItemWorkerOptions, IWorkerData} from "../../types/worker";
import {Random} from "../utils/Random";
import {ECommandType, EMessageSender, EResponseType, getResponseType, getSenderKey} from "../common";

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

    error(error: Error): void {
        const response = new MessageResponse('error', EResponseType.LOGGER, EMessageSender.WORKER, ECommandType.RUN, this.getMessage(error));
        parentPort?.postMessage(response);
    }

    info(mess: unknown): void {
        const response = new MessageResponse('info', EResponseType.LOGGER, EMessageSender.WORKER, ECommandType.RUN, this.getMessage(mess));
        parentPort?.postMessage(response);
    }

    verbose(mess: unknown): void {
        const response = new MessageResponse('verbose', EResponseType.LOGGER, EMessageSender.WORKER, ECommandType.RUN, this.getMessage(mess));
        parentPort?.postMessage(response);
    }

    warn(mess: unknown): void {
        const response = new MessageResponse('warning', EResponseType.LOGGER, EMessageSender.WORKER, ECommandType.RUN, this.getMessage(mess));
        parentPort?.postMessage(response);
    }

    private getMessage(mess: TAny): string {
        let message = `[controller:${handlerDefParams.controllerKey}][worker:${handlerDefParams.workerKey}]`
        if ((mess as TAnyObject).constructor.name === 'Object') {
            Object.entries(mess as {}).forEach(([key, val]) => message += `[${key}:${val ? (val as string).toString() : val}]`);
        } else message += `[msg:${mess ? (mess as string).toString() : mess}]`;
        return message;
    }

}

const handlerDefParams = {
    logger: new Logger(),
    controllerKey: '',
    workerKey: ''
}

class AbstractWorker {

    public readonly key: TTaskKey = Random.randomString(16);
    private opt = new WorkerOptions();
    private handlers: Record<string, any> = {};
    private requests: Map<string, MessageRequest> = new Map<string, MessageRequest>();


    constructor() {
        this.opt.isActive = true;
        if (!parentPort) throw new Error('parentPort is undefined!')
        parentPort.on("message", this.run.bind(this));

        const errorEvents = ['rejectionHandled', 'uncaughtException', 'uncaughtExceptionMonitor', 'unhandledRejection'];
        errorEvents.forEach(v => process.addListener(v as any, (er?: Error) => this.sendCriticalError(er || new Error('unhandled rejection'), {command:ECommandType.RUN} as MessageRequest)))
        this.init().catch(er => this.sendCriticalError(er, {command:ECommandType.INIT} as MessageRequest));
    }

    private async init() {
        const workerInitData: IWorkerData = workerData;
        if (!workerInitData) {
            this.sendCriticalError(new Error('workerData not found'), {command:ECommandType.INIT} as MessageRequest);
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
            this.sendCriticalError(new Error('The list of handlers is empty'), {command:ECommandType.INIT} as MessageRequest)
        }

        handlerDefParams.controllerKey = this.opt.options.controllerKey;
        handlerDefParams.workerKey = this.key;
        handlerDefParams.logger.verbose({msg: 'new instance'});
    }

    private async run(req: IMessageRequest) {
        handlerDefParams.logger.verbose({
            sender: getSenderKey(req.sender).toString(),
            task: req.key,
            msg: 'request',
            exec: req.execute!
        })
        if (this.opt.isActive) {
            if (this.opt.mode === EWorkerMode.SYNC) {
                if (this.opt.isRun) return this.sendError(req, new Error('Sink worker is run'), EMessageSender.WORKER, EResponseType.ERROR);
            } else {
                if (this.requests.size > this.opt.options!.maxTaskAsync) {
                    return this.sendError(req, new Error('Tasks overflow'), EMessageSender.WORKER, EResponseType.ERROR);
                }
            }
            try {
                switch (req.command) {
                    case ECommandType.INIT:

                        break;
                    case ECommandType.RUN:
                        if (this.handlers[req.handler]) {
                            this.opt.runTask();
                            try {
                                const handler = this.handlers[req.handler];
                                let func: Function;
                                if (handler.constructor.name === 'Function') {
                                    func = handler;
                                } else {
                                    func = handler[req.execute!];
                                }
                                if (func) {
                                    let res = func.apply(handlerDefParams, req.params);
                                    if (res.constructor.name === 'Promise') {
                                        res = await res;
                                    }
                                    this.sendSuccess(req, EMessageSender.HANDLER, res);
                                } else {
                                    this.sendError(req, new Error('Function not found'), EMessageSender.WORKER);
                                }
                            } catch (e) {
                                this.sendError(req, e, EMessageSender.HANDLER, EResponseType.ERROR);
                            } finally {
                                this.opt.endRunTask();
                            }


                        } else {
                            this.sendError(req, new Error('Handler not found'), EMessageSender.WORKER);
                        }
                        break;
                    case ECommandType.ABORT_TASK:
                        // TODO what do you do?
                        // this.sendSuccess(req, EMessageSender.HANDLER, res);
                        break;
                    case ECommandType.CLOSE_WORKER:
                        this.destroy(ECommandType.CLOSE_WORKER);
                        break;

                }


            } catch (e) {
                this.sendError(req, e, EMessageSender.WORKER, EResponseType.ERROR);
            }

        } else {
            this.sendCriticalError(new Error('Worker is not active'), req);
        }
    }

    private sendToParent(mess: MessageResponse) {
        handlerDefParams.logger.verbose({
            sender: getSenderKey(mess.sender).toString(),
            task: mess.key,
            type: getResponseType(mess.type).toString(),
            msg: 'response'
        });
        parentPort?.postMessage(mess);
    }

    private sendSuccess(req: IMessageRequest, sender: EMessageSender, data: unknown) {
        this.sendToParent(new MessageResponse(req.key, EResponseType.SUCCESS, sender,req.command, data))
    }

    private sendError(req: IMessageRequest, error: Error, sender: EMessageSender, errorType?: EResponseType): void {
        const mess = `Error called method: '${req.execute}' to: '${getSenderKey(req.sender)}' with params: ${
            JSON.stringify(req.params)}, message: ${error?.message}`
        this.sendToParent(new MessageResponse(req.key, EResponseType.ERROR, sender, req.command, {
            code: errorType || EResponseType.ERROR,
            message: mess,
            stack: error.stack
        }));
    }

    private sendCriticalError(error: Error, req: IMessageRequest): void {
        this.sendToParent(new MessageResponse('worker_critical_error', EResponseType.CRITICAL_ERROR, EMessageSender.WORKER, req.command,{
            code: EResponseType.CRITICAL_ERROR,
            message: error.message,
            stack: error.stack
        }));
        this.destroy(EResponseType.CRITICAL_ERROR);
    }

    private destroy(code: number = 0): void {
        handlerDefParams.logger.verbose({msg: 'exit'})
        this.opt.exit();
        process.exit(code)
    }

}

new AbstractWorker();



