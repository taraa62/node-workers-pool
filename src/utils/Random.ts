export class Random {

    private static readonly symb: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    public static randomString(size: number = 7): string {
        let text = '';
        for (let i = 0; i < size; i++)
            text += Random.symb.charAt(Math.floor(Math.random() * Random.symb.length));

        return text;
    }
}
