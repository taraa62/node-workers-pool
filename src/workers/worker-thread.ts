import {parentPort} from "worker_threads";
import {ECommandType, EMessageSender, EResponseType, getResponseType, getSenderKey} from "../common";
import {MessageResponse} from "../task";
import {ILogger, TAny, TAnyObject} from "../../types/common";
import {AbstractWorker, handlerDefParams} from "./abstract-worker";


class Logger implements ILogger {

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

handlerDefParams.logger = new Logger();

class WorkerThread extends AbstractWorker {

    constructor() {

        super();
        if (!parentPort) throw new Error('parentPort is undefined!')
        parentPort.on("message", super.run.bind(this));
    }

    protected sendToParent(mess: MessageResponse): void {
        handlerDefParams.logger.verbose({
            sender: getSenderKey(mess.sender).toString(),
            task: mess.key,
            type: getResponseType(mess.type).toString(),
            msg: 'response'
        });
        parentPort?.postMessage(mess);
    }
}

new WorkerThread();
