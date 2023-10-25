import express from "express";
import expressNunjacks from "express-nunjucks";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import {MikroNode, MikrotikResponse} from "mikrotik-node";

dotenv.config();

const MIKROTIK_IP = process.env.MIKROTIK_IP ?? "192.168.1.1";
const MIKROTIK_USERNAME = process.env.MIKROTIK_USERNAME ?? "admin";
const MIKROTIK_PASSWORD = process.env.MIKROTIK_PASSWORD ?? "admin";

const app = express();

app.use(bodyParser.json());

app.set('views', __dirname + '/templates');
expressNunjacks(app);

function extractError(response: MikrotikResponse): string {
    const data = response.data;
    if (!data) {
        return "unknown error";
    }

    const item = data[0];
    if ("value" in item) {
        return item.value;
    }

    return "unknown error";
}

app.get('/', (request, response) => {
    (async () => {
        const device = new MikroNode(MIKROTIK_IP);
        const [login] = await device.connect();
        const connection = await login(MIKROTIK_USERNAME, MIKROTIK_PASSWORD);
        const channel = connection.openChannel('dhcp-info');
        channel.on('trap', e => {
            channel.close();
            connection.close();
            response.status(500).end(extractError(e));
        });
        channel.on('done', data => {
            channel.close();
            connection.close();
            const rawData = data.data;

            if (!rawData) {
                response.status(500).end('Error?');
                return;
            }

            const dataObject = MikroNode.resultsToObj(rawData).sort((a, b) => {
                const ipValueA = a['address']
                    .split('.')
                    .map((item, index) => parseInt(item) * (Math.pow(256, 3 - index)))
                    .reduce((c, v) => c + v);
                const ipValueB = b['address']
                    .split('.')
                    .map((item, index) => parseInt(item) * (Math.pow(256, 3 - index)))
                    .reduce((c, v) => c + v);

                return ipValueA - ipValueB;
            });

            const serverResults: Record<string, {
                id: string,
                ip: string,
                mac: string,
                name: string,
                comment: string,
                isPinned: boolean,
                isOnline: boolean
            }[]> = {};

            for (const item of dataObject) {
                if (!serverResults[item['server']]) {
                    serverResults[item['server']] = [];
                }

                serverResults[item['server']].push({
                    id: item['.id'],
                    ip: item['address'],
                    mac: item['mac-address'],
                    name: item['host-name'] ?? '-',
                    comment: item['comment'],
                    isOnline: !!item['expires-after'],
                    isPinned: item['dynamic'] !== 'true'
                })
            }

            response.render('index', {
                results: serverResults
            });
        });
        await channel.write('/ip/dhcp-server/lease/print');
    })().catch(e => {
        response.status(500).end(e.toString());
    });
});

app.post('/make-static', (request, response) => {
    const id = String(request.body.id ?? "");

    (async () => {
        const device = new MikroNode(MIKROTIK_IP);
        const [login] = await device.connect();
        const connection = await login(MIKROTIK_USERNAME, MIKROTIK_PASSWORD);
        const channel = connection.openChannel('dhcp-pin');
        channel.on('trap', e => {
            channel.close();
            connection.close();
            response.status(500).end(extractError(e));
        });
        channel.on('done', data => {
            channel.close();
            connection.close();
            response.end();
        });
        await channel.write('/ip/dhcp-server/lease/make-static', {
            '.id': id
        });
    })().catch(e => {
        response.status(500).end(e.toString());
    });
});

app.post('/remove', (request, response) => {
    const id = String(request.body.id ?? "");

    (async () => {
        const device = new MikroNode(MIKROTIK_IP);
        const [login] = await device.connect();
        const connection = await login(MIKROTIK_USERNAME, MIKROTIK_PASSWORD);
        const channel = connection.openChannel('dhcp-remove');
        channel.on('trap', e => {
            channel.close();
            connection.close();
            response.status(500).end(extractError(e));
        });
        channel.on('done', data => {
            channel.close();
            connection.close();
            response.end();
        });
        await channel.write('/ip/dhcp-server/lease/remove', {
            '.id': id
        });
    })().catch(e => {
        response.status(500).end(e.toString());
    });
});

app.post('/comment', (request, response) => {
    const id = String(request.body.id ?? "");
    const comment = String(request.body.comment ?? "");
    
    (async () => {
        const device = new MikroNode(MIKROTIK_IP);
        const [login] = await device.connect();
        const connection = await login(MIKROTIK_USERNAME, MIKROTIK_PASSWORD);
        const channel = connection.openChannel('dhcp-comment');
        channel.on('trap', e => {
            channel.close();
            connection.close();
            response.status(500).end(extractError(e));
        });
        channel.on('done', data => {
            channel.close();
            connection.close();
            response.end();
        });
        await channel.write('/ip/dhcp-server/lease/set', {
            '.id': id,
            'comment': comment
        })
    })().catch(e => {
        response.status(500).end(e.toString());
    });
})

app.listen(parseInt(process.env.PORT ?? "8000"));