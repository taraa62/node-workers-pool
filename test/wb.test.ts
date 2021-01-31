import {promisify} from 'util';
import {IService} from "../types/service";
import {EWorkerMode, ILogger} from "../types/common";
import {WorkerService} from "../src/workerService";
import {IBBWorker, ICC} from "../handlers/IHandler";

const pause = promisify(setTimeout);

describe('test', () => {
    const logger: ILogger = {
        error: console.error,
        info: console.info,
        verbose: console.log,
        warning: console.info
    }

    const service: IService = new WorkerService({
        logger,
    });
    afterAll(()=>{
        // service
    })

    test('test1', async () => {
        await pause(500)
        console.log(service.getAvailableHandlers());

        service.addPool({
            name: 'pool',
            mode: EWorkerMode.SYNC,
            handlers: ['aa.worker', 'bb.worker', 'cc.worker'],
            taskOpt:{

            }
        });

        const handlerBB = service.getHandlerObject<IBBWorker>('pool', 'bb.worker');
        const bb = await handlerBB.bb();
        console.info(bb);

        const bbP = await handlerBB.bbP('taraa62', 11);
        console.info(bbP);

        const handlerCC = service.getHandlerFunc<ICC>('pool', 'cc.worker');
        const bbRes = await handlerCC();
        console.log(bbRes);


        service.addPool({
            name: 'pool1', mode: EWorkerMode.SYNC, handlers: ['cc.worker']
        });

        const ba = service.getHandlerObject<IBBWorker>('pool1', 'bb.worker');
        const aa = await ba.bb();
        console.info(aa);

    }, 5000)

    test.skip('proxy func',()=>{
        function sum(a:number, b:number) {
            return a + b;
        }

        const handler = {
            apply: function(target:any, thisArg:any, argumentsList:any) {
                console.log(`Calculate sum: ${argumentsList}`);
                // expected output: "Calculate sum: 1,2"

                return target(argumentsList[0], argumentsList[1]) * 10;
            }
        };

        const proxy1 = new Proxy(sum, handler);

        console.log(sum(1, 2));
// expected output: 3
        console.log(proxy1(1, 2));
// expected output

    })
})


// const handler: IaaHandlers = service.getHandler<IaaHandlers>('pool1')
