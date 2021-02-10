import {IWorkerHandler} from "../types/worker";

export function bb() {
    return new Promise(res => {
        setTimeout(() => {
            res('result from bb without params')
        }, 1500)
    })
}

export function bbP(val: string, val1: number): string {
    return `return bb.worker, func=bbP, param- ${val}, param2-${val1}`;
}

export function sum(val1: number, val2: number) {
    return new Promise(res => {
        setTimeout(() => {
            res(val1 + val2);
        }, Math.floor(Math.random()) * 100)
    })
}

export function returnData(val: number) {
    return new Promise(res => {
        setTimeout(() => {
            res(val);
        }, Math.floor(Math.random()) * 100)
    })
}

export function returnDataLong(this: IWorkerHandler, val: number, time: number) {
    this.logger.info('time: ' + time);
    return new Promise(res => {
        setTimeout(() => {
            res(val);
        }, time)
    })
}
