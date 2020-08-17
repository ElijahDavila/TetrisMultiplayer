(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
'use strict';

module.exports = function () {
  throw new Error(
    'ws does not work in the browser. Browser clients must use the native ' +
      'WebSocket object'
  );
};

},{}],2:[function(require,module,exports){
class Client
{
    constructor(conn, id)
    {
        this.conn = conn;
        this.id = id;
        this.session = null;

        this.state = {
            arena: {
                matrix: [],
            },
            player: {
                matrix: [],
                pos: {x: 0, y: 0},
                score: 0,
            },
        };
    }

    broadcast(data)
    {
        if (!this.session) {
            throw new Error('Can not broadcast without session');
        }

        data.clientId = this.id;

        [...this.session.clients]
            .filter(client => client !== this)
            .forEach(client => client.send(data));
    }

    send(data)
    {
        const msg = JSON.stringify(data);
        console.log(`Sending message ${msg}`);
        this.conn.send(msg, function ack(err) {
		if (err) {
			console.log('Error sending message', msg, err);
		}
	});
    }
}

module.exports = Client;

},{}],3:[function(require,module,exports){
const WebSocketServer = require('ws').Server;
const Session = require('./session');
const Client = require('./client');

const server = new WebSocketServer({port: 9000});

const sessions = new Map;

function createId(len = 6, chars = 'abcdefghjkmnopqrstvwxyz01234567890') {
    let id = '';
    while (len--) {
        id += chars[Math.random() * chars.length | 0];
    }
    return id;
}

function createClient(conn, id = createId()) {
    return new Client(conn, id);
}

function createSession(id = createId()) {
    if (sessions.has(id)) {
        throw new Error(`Session ${id} already exists`);
    }

    const session = new Session(id);
    console.log('Creating session', session);

    sessions.set(id, session);

    return session;
}

function getSession(id) {
    return sessions.get(id);
}

function broadcastSession(session) {
    const clients = [...session.clients];
    clients.forEach(client => {
        client.send({
            type: 'session-broadcast',
            peers: {
                you: client.id,
                clients: clients.map(client => {
                    return {
                        id: client.id,
                        state: client.state,
                    }
                }),
            },
        });
    });
}

server.on('connection', conn => {
    console.log('Connection established');
    const client = createClient(conn);

    conn.on('message', msg => {
        console.log('Message received', msg);
        const data = JSON.parse(msg);

        if (data.type === 'create-session') {
            const session = createSession();
            session.join(client);

            client.state = data.state;
            client.send({
                type: 'session-created',
                id: session.id,
            });
        } else if (data.type === 'join-session') {
            const session = getSession(data.id) || createSession(data.id);
            session.join(client);

            client.state = data.state;
            broadcastSession(session);
        } else if (data.type === 'state-update') {
            const [key, value] = data.state;
            client.state[data.fragment][key] = value;
            client.broadcast(data);
        }

    });

    conn.on('close', () => {
        console.log('Connection closed');
        const session = client.session;
        if (session) {
            session.leave(client);
            if (session.clients.size === 0) {
                sessions.delete(session.id);
            }
        }

        broadcastSession(session);

        console.log(sessions);
    });
});

},{"./client":2,"./session":4,"ws":1}],4:[function(require,module,exports){
class Session
{
    constructor(id)
    {
        this.id = id;
        this.clients = new Set;
    }
    join(client)
    {
        if (client.session) {
            throw new Error('Client already in session');
        }
        this.clients.add(client);
        client.session = this;
    }
    leave(client)
    {
        if (client.session !== this) {
            throw new Error('Client not in session');
        }
        this.clients.delete(client);
        client.session = null;
    }
}

module.exports = Session;

},{}]},{},[3]);
