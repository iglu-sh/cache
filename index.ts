import type {NextFunction, Request, Response} from 'express'
import bodyParser from "express";
import fs from "fs";
import raw from 'express'
import db from "./utils/db";
import createRouter, {router} from "express-file-routing"
const app = require('express')()
const pino = require('pino-http')()


let parseJson = bodyParser.json()

//app.use(pino)
// Middleware to handle all routes
const Database = new db();

app.use(raw())

await createRouter(app, {
    additionalMethods: [ "ws" ]
})

//app.use("/", await router())
app.use((req, res) => {
//    req.log.info(req.url)
    console.log('CATCHALL', req.url)

    if(req.body){
    //    console.log('Req body', req.body)
        //fs.writeFileSync(__dirname + "/req.json", JSON.stringify(req.body), "utf8")
    }
    res.status(200).send('OK');
});

app.listen(3000)