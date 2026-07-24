import { pool } from '../src/db/pool'
import {createRooms } from '../src/socketConnection/createRoom'
import {beforeAll, afterAll, describe, expect, it, beforeEach} from 'vitest'
import {createServer} from 'node:http'
import type {AddressInfo} from 'node:net'
import {Server, type Socket as serverSocket} from 'socket.io'
import {io as ioc, type Socket as clientSocket} from 'socket.io-client'

describe('connection Room', () => {
  let io:Server, serverSocket:serverSocket, clientSocket:clientSocket;

  //before testing, this initializes the servers, selects org seeded data to initialize orgId and calls my 'createRooms' function 
  beforeAll(async() => {
    const {rows: [org]} = await pool.query(`SELECT id FROM orgs LIMIT 1`);
    orgId = org.id
    return new Promise((resolve: (value: void) => void) => {
      const server = createServer();
      io = new Server(server);
      server.listen(() => {
        const port = (server.address() as AddressInfo).port
        clientSocket = ioc(`http://localhost:${port}`)
        io.on('connection', (socket) => {
          console.log('server got connection')
          socket.data.orgId = orgId
          createRooms(io, socket)
        })
        clientSocket.on('connect', () => resolve());
        console.log('hi')
      })
    })
  })

  //isolating DB depenedency by seeding mock data 
  //beforeEach allows us to initialize our query after each test since eavery test collapses
  let incidentId: number;
  let orgId: string
  beforeEach(async() => {
    const {rows: [org]} = await pool.query(`SELECT id FROM orgs LIMIT 1`)
    const {rows: [user]} = await pool.query(`
      INSERT INTO users (email, password_hash, role, org_id)
      VALUES($1, $2, $3, $4) RETURNING id`, ['a@gmail.com','hash','responder', org.id])
      const {rows: [inc]} = await pool.query(`INSERT INTO incidents (title, status, org_id, severity, created_by, affected_system)
        VALUES($1, $2, $3, $4, $5, $6) RETURNING id`, ['mog', 'detected', org.id, 'P1', user.id, 'environment'])
    incidentId = Number(inc.id)
    orgId = org.id
  })

  //After test, we disconnect the client socket
  afterAll(() => {
    io.close();
    clientSocket.disconnect();
  })

  //test to see if room is not empty 
  it('joining-room', () => {
    return new Promise(async(resolve: (value: void) => void, reject) => {
      clientSocket.once('success', () => {
        try{
            const counting = io.of('/').adapter.rooms.get(String(incidentId))?.size || 0; //gets the size of room
            expect(counting).toBeGreaterThan(0)
            resolve();
          } catch(err) {
            reject(err)
          }
        })
      clientSocket.emit('join-room', incidentId)
    })
  })
})