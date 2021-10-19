import { PrismaClient } from '@prisma/client'
import * as bodyParser from 'body-parser'
import express from 'express'
import {Socket} from "socket.io";
import { DefaultEventsMap } from 'socket.io/dist/typed-events';

const prisma = new PrismaClient()
const app = express()

const cors = require('cors');

app.use(bodyParser.json());
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Authorization");
  res.header("Content-Type", "application/json");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Credentials", "true");
  next();
});
app.options('*', cors());

const serve = app.listen(3001, () => {
  console.log('server running on port 3001');
})

const io = require('socket.io')(serve, {
  cors: {
    origin: "http://localhost:8080",
    methods: ["GET", "POST"],
    allowedHeaders: ["phaser"],
    credentials: true
  }
})

let lastID = 0;
let players: { id: number; x: number; y: number}[] = [];

io.on('connection', (socket: Socket) =>{
  console.log();
  console.log('new connection with', socket.id);
  let player = {
    id: lastID++,
    x: Math.floor(Math.random() * 400) + 350,
    y: 1000,
  };
  players.push(player)

  socket.on('ping', data =>{
    console.log('ping from', socket.id);
    io.emit('pong');
  });
  socket.on('newplayer', ()=>{
    console.log('new player with id:', player.id);
    socket.emit('allplayers', players);
    socket.broadcast.emit('newplayer', player)
  })
  socket.on('playermovement', (data)=>{
    let anims = data.anims;
    players[player.id].x = data.x;
    players[player.id].y = data.y;
    socket.broadcast.emit('playermoved', players[player.id], anims);
  })
  socket.on('disconnect', ()=>{
    console.log('User with id', player.id, 'disconnected');
    players[player.id] = {id: player.id, x: 0, y: 0};
    socket.broadcast.emit('destroyplayer', player.id);
  })
})

app.post(`/user`, async (req, res) => {
  const result = await prisma.user.create({
    data: {
      ...req.body,
    },
  })
  res.json(result)
})

app.post(`/post`, async (req, res) => {
  const { title, content, authorEmail } = req.body
  const result = await prisma.post.create({
    data: {
      title,
      content,
      published: false,
      author: { connect: { email: authorEmail } },
    },
  })
  res.json(result)
})

app.put('/publish/:id', async (req, res) => {
  const { id } = req.params
  const post = await prisma.post.update({
    where: { id: Number(id) },
    data: { published: true },
  })
  res.json(post)
})

app.delete(`/post/:id`, async (req, res) => {
  const { id } = req.params
  const post = await prisma.post.delete({
    where: {
      id: Number(id),
    },
  })
  res.json(post)
})

app.get(`/post/:id`, async (req, res) => {
  const { id } = req.params
  const post = await prisma.post.findUnique({
    where: {
      id: Number(id),
    },
  })
  res.json(post)
})

app.get('/feed', async (req, res) => {
  const posts = await prisma.post.findMany({
    where: { published: true },
    include: { author: true },
  })
  res.json(posts)
})

app.get('/filterPosts', async (req, res) => {
  const { searchString }: { searchString?: string } = req.query
  const draftPosts = await prisma.post.findMany({
    where: {
      OR: [
        {
          title: {
            contains: searchString,
          },
        },
        {
          content: {
            contains: searchString,
          },
        },
      ],
    },
  })
  res.json(draftPosts)
})

const server = app.listen(3000, () =>
  console.log(
    '🚀 Server ready at: http://localhost:3000\n⭐️ See sample requests: http://pris.ly/e/ts/rest-express#3-using-the-rest-api',
  ),
)
