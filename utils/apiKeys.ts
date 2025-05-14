import jwt from 'jsonwebtoken';
import 'dotenv/config';
export function makeApiKey(cacheName:string):string{
    //We can be sure that this exists as we check for it in the index.ts file
    return jwt.sign({name:cacheName}, process.env.CACHE_JWT_SECRET as string)
}