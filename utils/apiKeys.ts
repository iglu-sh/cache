import jwt from 'jsonwebtoken';

export function makeApiKey(cacheName:string):string{
    return jwt.sign({name:cacheName}, 'verysecretencryptionkey')
}