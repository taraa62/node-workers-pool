export function bb() {
    return new Promise(res => {
        setTimeout(() => {
            res('result from bb without params')
        }, 1500)
    })
}

export function bbP(val: string, val1: number):string {
    return `return bb.worker, func=bbP, param- ${val}, param2-${val1}`;
}
