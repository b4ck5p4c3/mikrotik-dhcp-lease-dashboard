declare module 'mikrotik-node' {
    export type LoginFunction = (username: string, password: string) => Promise<Connection>;

    export interface MikrotikResponseDataItem {
        field: string;
        value: string;
    }

    export type MikrotikResponseData = MikrotikResponseDataItem[][] | MikrotikResponseDataItem[];

    export interface MikrotikResponse {
        cmd: {
            id: number;
            command: string;
            args: string[];
        };
        tag: string;
        data?: MikrotikResponseData;
    }

    export class Channel {
        write(command: string, args?: Record<string, string | boolean | number> | string[]): void;
        on(event: 'done', callback: (data: MikrotikResponse) => void): void;
        on(event: 'trap', callback: (error: MikrotikResponse) => void): void;
        close(): void;
    }

    export class Connection {
        openChannel(id: string, closeOnDone?: boolean): Channel;
        close(): void;
    }

    export class MikroNode {
        constructor(host: string, port?: number, timeout?: number);
        
        connect(): Promise<[LoginFunction]>;
        static resultsToObj(data: MikrotikResponseData): Record<string, string>[];
    }
}