//This endpoint is used to handle the completion of a multipart upload for a nar file.
//It inserts the nar file into the database

import bodyParser from "express";
import type { Request, Response, NextFunction } from "express";
import fs from 'fs'
import Database from "../../../../../../../utils/db.ts";
import {isAuthenticated} from "../../../../../../../utils/middlewares/auth.ts";
export const post = [
    bodyParser.json(),
    async (req: Request, res: Response, next: NextFunction) => {

        if(req.method !== 'POST'){
            return res.status(405).json({
                error: 'Method not allowed',
            })
        }
        //Check if the user is authenticated
        const auth = await isAuthenticated(req, res, async () => {
            return true
        })
        if(!auth){
            return;
        }

        //Check if the request is an application/json request
        if(!req.headers['content-type']?.startsWith('application/json')){
            return res.status(400).json({
                error: 'Invalid content type, expected application/json',
            })
        }

        //Check if the request has a narInfoCreate object
        if(!req.body.narInfoCreate){
            console.error('Missing narInfoCreate object')
            return res.status(400).json({
                error: 'Missing narInfoCreate object',
            })
        }

        //Check if the request has a parts array
        if(!req.body.parts){
            console.error('Missing parts array')
            return res.status(400).json({
                error: 'Missing parts array',
            })
        }

        //Check if the request has a cache name
        if(!req.params.cache ){
            console.error('Missing cache name')
            return res.status(400).json({
                error: 'Missing cache name',
            })
        }

        //Check if the request has a uid
        if(!req.params.uid){
            console.error('Missing uid')
            return res.status(400).json({
                error: 'Missing uid',
            })
        }

        //Check if the request uid has an associated cache object in the filesystem
        if(!fs.existsSync(`./nar_files/${req.params.cache}`)){
            console.error('Cache does not exist')
            return res.status(400).json({
                error: 'Cache does not exist',
            })
        }
        console.log(req.body)
        //Check if the request has a valid narInfoCreate object
        if(!req.body.narInfoCreate.cDeriver
            || !req.body.narInfoCreate.cFileHash
            || !req.body.narInfoCreate.cFileSize
            || !req.body.narInfoCreate.cNarHash
            || !req.body.narInfoCreate.cNarSize
            || !req.body.narInfoCreate.cReferences
            || !req.body.narInfoCreate.cStoreHash
            || !req.body.narInfoCreate.cStoreSuffix
        ){
            console.error('Invalid narInfoCreate object')
            return res.status(400).json({
                error: 'Invalid narInfoCreate object',
            })
        }

        //Check if the request has a valid parts array
        if(!Array.isArray(req.body.parts)){
            console.error('Invalid parts array')
            return res.status(400).json({
                error: 'Invalid parts array',
            })
        }

        //Construct the Database object
        const db = new Database()

        //...and insert the narinfo into the database
        try{
            await db.createStorePath(req.params.cache, req.body, req.params.uid)
        }
        catch(e){
            console.error('Error inserting narInfo into database:', e)
            return res.status(500).json({
                error: 'Internal server error',
            })
        }
        await db.close()
        return res.status(200).send();
    }
]