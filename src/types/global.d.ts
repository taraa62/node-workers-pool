export type TAnyObject = Record<string, any>
export type TAny<T = any> = string | number | boolean | TAnyObject | T;
