import {WorkerService} from "../src/service";
import {IService} from "../types/service";
import {EWorkerMode, ILogger} from "../types/common";
import util from "util";

// @ts-ignore
const pause = util.promisify(setTimeout);

describe('test', () => {

    test('test1', async () => {

        const logger: ILogger = {
            error: console.error,
            info: console.info,
            verbose: console.log
        }

        const service: IService = new WorkerService({
            logger
        });
        await pause(500)
        console.log(service.getAvailableHandlers());

        service.addPool({
            name: 'pool', mode: EWorkerMode.SYNC, handlers:['aa.worker']
        });
    }, 5000)


})


// const handler: IaaHandlers = service.getHandler<IaaHandlers>('pool1')
