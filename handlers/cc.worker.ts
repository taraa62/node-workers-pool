module.exports = () => {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve('I am from cc.worker')
        }, 2000);
    })
}
