import {promisify} from 'util';
import {IService} from "../types/service";
import {EWorkerMode, ILogger} from "../types/common";
import {WorkerService} from "../src/workerService";
import {IaaWorker} from "../handlers/Iaa.worker";

const pause = promisify(setTimeout);

describe('test', () => {

    test('test1', async () => {

        const logger: ILogger = {
            error: console.error,
            info: console.info,
            verbose: console.log,
            warning: console.info
        }

        const service: IService = new WorkerService({
            logger
        });
        await pause(500)
        console.log(service.getAvailableHandlers());

        service.addPool({
            name: 'pool', mode: EWorkerMode.SYNC, handlers: ['aa.worker']
        });

        const handler = service.getHandler<IaaWorker>('pool', 'aa.worker');
        // const hw = await handler.getHelloWorld('Helllllooooo');
        // console.info(hw);
        console.info(handler);

    }, 5000)


})


// const handler: IaaHandlers = service.getHandler<IaaHandlers>('pool1')
