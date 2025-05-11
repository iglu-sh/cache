import type {Request, Response} from "express";
import md5File from 'md5-file'
import fs from 'fs'
function reqWasAborted(req:Request){
    return req.socket.destroyed || req.socket.readableEnded || req.socket.writableEnded
}
export const put = async (req:Request, res:Response)=>{
    if(req.method !== 'PUT'){
        return res.status(405).json({
            error: 'Method not allowed',
        })
    }
    console.log(req.url);


    //Check if the request is an application/octet-stream request
    if(!req.headers['content-type']?.startsWith('application/octet-stream')){
        return res.status(400).json({
            error: 'Invalid content type, expected application/octet-stream',
        })
    }

    //Check if the request has a md5 hash
    if(!req.query.md5){
        console.error('Missing md5 hash')
        return res.status(400).json({
            error: 'Missing md5 hash',
        })
    }

    //Create the directory if it does not exist
    if(!fs.existsSync(`./nar_files/${req.params.cache}`)){
        fs.mkdirSync(`./nar_files/${req.params.cache}`, {recursive: true})
    }
    const filePath = `./nar_files/${req.params.cache}/${req.params.uid}.nar.xz`
    //Create a write stream to the nar file
    const writeStream = fs.createWriteStream(filePath)

    //Pipe the request to the write stream
    req.pipe(writeStream)

    //Handle the end of the request
    req.on('end', () => {
        writeStream.end()
        console.log("End")
    })
    //Handle the finish on the write stream
    writeStream.on("finish", async ()=>{
        if(reqWasAborted(req)){
            console.error('Request was aborted')
            fs.unlinkSync(filePath)
            return res.status(400).json({
                error: 'Request was aborted',
            })
        }
        //TODO: Implement hash check
        res.status(200).send('OK')
    })

    //Handle errors on the write stream
    writeStream.on('error', (e)=>{
        console.error(e)
        res.status(500).json({
            error: 'Internal server error',
        })
    })
}
