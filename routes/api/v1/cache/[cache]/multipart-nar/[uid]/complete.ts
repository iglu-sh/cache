//This endpoint is used to handle the completion of a multipart upload for a nar file.
//It inserts the nar file into the database

import bodyParser from "express";
import type { Request, Response, NextFunction } from "express";
import fs from 'fs'
import db from "../../../../../../../utils/db.ts";
import {isAuthenticated} from "../../../../../../../utils/middlewares/auth.ts";
import getFileHash from "../../../../../../../utils/getFileHash.ts";
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
        if(!fs.existsSync(`${process.env.CACHE_FILESYSTEM_DIR}/nar_files/${req.params.cache}`)){
            console.error('Cache does not exist')
            return res.status(400).json({
                error: 'Cache does not exist',
            })
        }
        //Get the compression from the uid
        if(!req.params.uid || req.params.uid[0] !== '0' && req.params.uid[0] !== '1'){
            console.error('Invalid uid, expected 0 or 1 as first character')
            return res.status(400).json({
                error: 'Invalid uid',
            })
        }
        const Database = new db()

        async function wrap() {

            //@ts-ignore
            const cacheID = await Database.getCacheID(req.params.cache)
            if (cacheID === -1) {
                await Database.close()
                return res.status(404).json({
                    error: "Cache not found",
                });
            }
            const cacheInfo = await Database.getCacheInfo(cacheID)
            //@ts-ignore
            const compression = req.params.uid[0] === '0' ? 'xz' : 'zstd'
            if (cacheInfo.publicSigningKeys.length === 0) {
                res.status(400).send(`There is no public signing key for this cache, add one by using cachix generate-keypair ${cacheInfo.name}`)
                //Unlink all the parts files
                for (const part of req.body.parts) {
                    fs.unlinkSync(`${process.env.CACHE_FILESYSTEM_DIR}/nar_files/${req.params.cache}/${req.params.uid}.nar.${compression}.${part.partNumber}`)
                }
                await Database.close()
                return;
            }

            //Check if the request has a valid narInfoCreate object
            if (!req.body.narInfoCreate.cDeriver
                || !req.body.narInfoCreate.cFileHash
                || !req.body.narInfoCreate.cFileSize
                || !req.body.narInfoCreate.cNarHash
                || !req.body.narInfoCreate.cNarSize
                || !req.body.narInfoCreate.cReferences
                || !req.body.narInfoCreate.cStoreHash
                || !req.body.narInfoCreate.cStoreSuffix
            ) {
                console.error('Invalid narInfoCreate object')
                return res.status(400).json({
                    error: 'Invalid narInfoCreate object',
                })
            }

            //Check if the request has a valid parts array
            if (!Array.isArray(req.body.parts)) {
                console.error('Invalid parts array')
                return res.status(400).json({
                    error: 'Invalid parts array',
                })
            }
            //Now try to combine the parts of the upload into a single archive file
            //Check if the request has a valid parts array
            if (!Array.isArray(req.body.parts)) {
                console.error('Invalid parts array')
                return res.status(400).json({
                    error: 'Invalid parts array',
                })
            }

            //Loop over the parts array and combine the file
            for (const part of req.body.parts) {
                //Check if the part has a valid eTag and partNumber
                if (!part.eTag || !part.partNumber || typeof part.partNumber !== 'number') {
                    console.error('Invalid part object')
                    return res.status(400).json({
                        error: 'Invalid part object',
                    })
                }

                const partNumber = parseInt(part.partNumber)
                if (!Number.isInteger(partNumber)) {
                    console.error('Part number is not an integer')
                    return res.status(400).json({
                        error: 'Part number is not an integer',
                    })
                }

                //Check if the part file exists
                const partFilePath = `${process.env.CACHE_FILESYSTEM_DIR}/nar_files/${req.params.cache}/${req.params.uid}.nar.${compression}.${part.partNumber}`
                if (!fs.existsSync(partFilePath)) {
                    console.error(`Part file ${partFilePath} does not exist`)
                    return res.status(400).json({
                        error: 'Part file does not exist',
                    })
                }
                //Combine the part into the final file
                const finalFilePath = `${process.env.CACHE_FILESYSTEM_DIR}/nar_files/${req.params.cache}/${req.params.uid}.nar.${compression}`
                fs.appendFileSync(finalFilePath, fs.readFileSync(partFilePath))
                //Delete the part file
                fs.unlinkSync(partFilePath)
            }

            try{
                //Verify the hash of the final file
                const finalFilePath = `${process.env.CACHE_FILESYSTEM_DIR}/nar_files/${req.params.cache}/${req.params.uid}.nar.${compression}`
                const fileHash = req.body.narInfoCreate.cFileHash;
                const actualFileHash = await getFileHash(finalFilePath);
                if (actualFileHash !== fileHash) {
                    console.log(`File hash: ${actualFileHash}, expected: ${fileHash}`)
                    console.error('File hash does not match')
                    return res.status(400).json({
                        error: 'File hash does not match',
                    })
                }
            }
            catch(e){
                console.error('Error getting file hash:', e)
                await Database.close()
                return res.status(500).json({
                    error: 'Internal server error',
                })
            }

            //...and insert the narinfo into the database
            try {
                //@ts-ignore
                await Database.createStorePath(req.params.cache, req.body, req.params.uid, compression)
            } catch (e) {
                console.error('Error inserting narInfo into database:', e)
                return res.status(500).json({
                    error: 'Internal server error',
                })
            }
        }
        await wrap().then(async()=>{

        })
            .catch(e=>{
                console.error('Error inserting narInfo into database:', e)
                return res.status(500).json({
                    error: 'Internal server error',
                })
            })
            .finally(async ()=>{
                await Database.close()
            })
        return res.status(200).send();
    }
]