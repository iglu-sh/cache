import type { Request, Response } from 'express'
import createRouter, {router} from "express-file-routing"
const app = require('express')()
const pino = require('pino-http')()

app.use(pino)

app.use("/", await router())

// Middleware to handle all routes
app.use((req, res) => {
    req.log.info(req.url, req.method)
    res.status(200).send('OK');
});

app.listen(3000)