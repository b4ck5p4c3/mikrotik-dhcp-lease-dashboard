import express from "express";
import dotenv from "dotenv";
import {MikroNode} from "mikrotik-node";

dotenv.config();

const MIKROTIK_IP = process.env.MIKROTIK_IP ?? "192.168.1.1";
const MIKROTIK_USERNAME = process.env.MIKROTIK_USERNAME ?? "admin";
const MIKROTIK_PASSWORD = process.env.MIKROTIK_PASSWORD ?? "admin";

const app = express();

app.get('/', (request, response) => {
    (async () => {
        const device = new MikroNode(MIKROTIK_IP);
        const [login] = await device.connect();
        const connection = await login(MIKROTIK_USERNAME, MIKROTIK_PASSWORD);
        const channel = connection.openChannel('dhcp-info');
        channel.on('trap', e => {
            channel.close();
            connection.close();
            response.end(e.toString());
        });
        channel.on('done', data => {
            channel.close();
            connection.close();
            const rawData = data.data;

            if (!rawData) {
                response.end('Error?');
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
                ip: string,
                mac: string,
                name: string,
                comment: string,
                rowClass: string
            }[]> = {};

            for (const item of dataObject) {
                if (!serverResults[item['server']]) {
                    serverResults[item['server']] = [];
                }

                serverResults[item['server']].push({
                    ip: `${item['dynamic'] === 'true' ? '' : '📌'}${item['expires-after'] ? '' : '💀'} ${item['address']}`,
                    mac: item['mac-address'],
                    name: item['host-name'] ?? '-',
                    comment: item['comment'] ?? '-',
                    rowClass: item['expires-after'] ? 'item-on' : 'item-off'
                })
            }

            response.end(`<!DOCTYPE html>
            <html lang="en">
            
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    * {
                        font-family: monospace;
                    }
            
                    table {
                        width: 100%;
                    }
                    
                    table {
                        margin-top: 10px;
                        margin-bottom: 30px;
                    }
            
                    th, td {
                        border-bottom: 1px solid gray;
                        padding: 5px;
                        text-align: left;
                    }
                    
                    tr:nth-child(even) > td {
                        background-color: #eee;
                    }

                    body {
                        max-width: 1200px;
                        margin-left: auto;
                        margin-right: auto;
                        padding: 0 10px 200px 10px;
                    }

                    div {
                        font-size: large;
                    }

                    .item-off {
                        color: #888;
                    }
                </style>
                <title>DHCP leases</title>
            </head>
            
            <body>
                <h1>B4CKSP4CE DHCP leases</h1>
                ${
                    Object.keys(serverResults).map(item => `
                        <div>Server: <b>${item.replace(/</gi, '&lt;')}</b></div>
                        <table>
                            <tr>
                                <th>
                                    IP
                                </th>
                                <th>
                                    MAC
                                </th>
                                <th>
                                    Name
                                </th>
                                <th>
                                    Comment
                                </th>
                            </tr>
                            ${
                                serverResults[item].map(item => `<tr class="${item.rowClass}"><td>${item.ip}</td><td>${
                                    item.mac}</td><td>${item.name.replace(/</gi, '&lt;')}</td><td>${
                                        item.comment.replace(/</gi, '&lt;')}</td></tr>`).join('')
                            }
                        </table>
                    `).join('')
                }
            </body>
            
            </html>`);
        });
        channel.write('/ip/dhcp-server/lease/print');
    })().catch(e => {
        response.end(e.toString());
    });
});

app.listen(parseInt(process.env.PORT ?? "8000"));