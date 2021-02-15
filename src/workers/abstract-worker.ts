import {EWorkerMode, EWorkerType} from "../../types/common";
import {IMessageRequest, TTaskKey} from "../../types/controller";
import {MessageRequest, MessageResponse} from "../task";
import {IItemWorkerOptions, IWorkerHandler} from "../../types/worker";
import {Random} from "../utils/Random";
import {DefWorkerLogger, ECommandType, EMessageSender, EResponseType, getSenderKey} from "../common";
import {Readable} from "stream";

/*
потрібно обробку для скидання задачі
 */


export const handlerDefParams: IWorkerHandler = {
    logger: DefWorkerLogger,
    controllerKey: '',
    workerKey: ''
}

export abstract class AbstractWorker {
    protected readonly key: TTaskKey = Random.randomString(16);

    protected isRun = false;
    protected isActive = false;
    protected isClose = false;

    protected option?: IItemWorkerOptions = {
        type: EWorkerType.THREADS,
        mode: EWorkerMode.SYNC,
        handlers: {},
        controllerKey: '',
        maxTaskAsync: 100,
        timeout: 5000
    };

    protected handlers: Record<string, any> = {};
    protected requests: Map<string, MessageRequest> = new Map<string, MessageRequest>();

    protected mapStreams: Map<TTaskKey, Readable> = new Map<TTaskKey, Readable>();


    constructor() {
        this.isActive = true;
        const errorEvents = ['rejectionHandled', 'uncaughtException', 'uncaughtExceptionMonitor', 'unhandledRejection'];
        errorEvents.forEach(v => process.addListener(v as any, (er?: Error) => this.sendCriticalError(er || new Error('unhandled rejection'), {command: ECommandType.RUN} as MessageRequest)))
    }

    protected exit() {
        this.isActive = false;
        this.isClose = true;
    }

    protected runTask() {
        this.isRun = true;
    }

    protected endRunTask() {
        if (this.option!.mode === EWorkerMode.SYNC) {
            this.isRun = false
        }
    }


    protected async init(req: IMessageRequest): Promise<void> {
        this.option = req.params as IItemWorkerOptions;
        this.option.mode = this.option.mode ?? EWorkerMode.SYNC

        const entryHandlers = Object.entries(this.option.handlers);
        for (const [key, path] of entryHandlers) {
            if (key && path) {
                this.handlers[key] = await require(path);
            }
        }
        if (!Object.keys(this.handlers).length) {
            this.sendCriticalError(new Error('The list of handlers is empty'), {command: ECommandType.INIT} as MessageRequest)
        }

        handlerDefParams.controllerKey = this.option.controllerKey;
        handlerDefParams.workerKey = this.key;
        handlerDefParams.logger.verbose({msg: 'new instance'});
    }


    protected async run(req: IMessageRequest) {
        handlerDefParams.logger.verbose({
            sender: getSenderKey(req.sender).toString(),
            task: req.key,
            msg: 'request',
            exec: req.execute!
        })
        if (this.isActive) {
            if (this.option!.mode === EWorkerMode.SYNC) {
                if (this.isRun) return this.sendError(req, new Error('Sink worker is run'), EMessageSender.WORKER, EResponseType.ERROR);
            } else {
                if (this.requests.size > this.option!.maxTaskAsync) {
                    return this.sendError(req, new Error('Tasks overflow'), EMessageSender.WORKER, EResponseType.ERROR);
                }
            }
            try {
                switch (req.command) {
                    case ECommandType.INIT:
                        await this.init(req).catch(er => this.sendCriticalError(er, req));
                        this.sendSuccess(req, EMessageSender.WORKER, true);
                        break;
                    case ECommandType.RUN:
                        if (this.handlers[req.handler]) {
                            this.runTask();
                            try {
                                if(req.isStream){
                                    const stream = this.mapStreams.get(req.streamKey!);
                                    if (stream) {
                                        stream.push(req.params);
                                        return this.sendSuccess(req, EMessageSender.HANDLER, true);
                                    }
                                }



                                const handler = this.handlers[req.handler];
                                let func: Function;
                                if (handler.constructor.name === 'Function') {
                                    func = handler;
                                } else {
                                    func = handler[req.execute!];
                                }
                                if (func) {
                                    if (req.isStream && Array.isArray(req.params)) {
                                        if (!req.isChunk) {
                                            req.params.forEach((v, i, arr) => {
                                                if (v && typeof v === "object" && v.stream) {
                                                    switch (v.stream) {
                                                        case "ReadStream": {
                                                            const stream = arr[i] = new Readable({
                                                                objectMode: true,
                                                                read(size: number) {
                                                                }
                                                            });

                                                            this.mapStreams.set(req.key, stream);
                                                        }
                                                    }
                                                }
                                            })
                                        }
                                    }
                                    let res = func.apply(handlerDefParams, req.params);
                                    if (res && typeof res === "object" && res.constructor.name === 'Promise') {
                                        res = await res;
                                    }
                                    this.sendSuccess(req, EMessageSender.HANDLER, res);
                                } else {
                                    this.sendError(req, new Error('Function not found'), EMessageSender.WORKER);
                                }
                            } catch (e) {
                                this.sendError(req, e, EMessageSender.HANDLER, EResponseType.ERROR);
                            } finally {
                                this.endRunTask();
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

    protected abstract sendToParent(mess: MessageResponse): void;

    protected sendSuccess(req: IMessageRequest, sender: EMessageSender, data: unknown) {
        this.sendToParent(new MessageResponse(req.key, EResponseType.SUCCESS, sender, req.command, data))
    }

    protected sendError(req: IMessageRequest, error: Error, sender: EMessageSender, errorType?: EResponseType): void {
        const mess = `Error called method: '${req.execute}' to: '${getSenderKey(req.sender)}' with params: ${
            JSON.stringify(req.params)}, message: ${error?.message}`
        this.sendToParent(new MessageResponse(req.key, EResponseType.ERROR, sender, req.command, {
            code: errorType || EResponseType.ERROR,
            message: mess,
            stack: error.stack
        }));
    }

    protected sendCriticalError(error: Error, req: IMessageRequest): void {
        this.sendToParent(new MessageResponse('worker_critical_error', EResponseType.CRITICAL_ERROR, EMessageSender.WORKER, req.command, {
            code: EResponseType.CRITICAL_ERROR,
            message: error.message,
            stack: error.stack
        }));
        this.destroy(EResponseType.CRITICAL_ERROR);
    }

    protected destroy(code: number = 0): void {
        handlerDefParams.logger.verbose({msg: 'exit'})
        this.exit();
        process.exit(code)
    }

}
