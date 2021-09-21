import {
    Connection, Keypair, sendAndConfirmTransaction, Transaction, TransactionInstruction
} from '@solana/web3.js';
import log from 'loglevel';
import { MarketplaceInstruction } from '../data/model';
import { programId } from '../check';


export async function sayHello(connection: Connection, initiator: Keypair) {
    
    const programInfo = await connection.getAccountInfo(programId);
    if (programInfo === null) {
        throw new Error('Program needs to be built and deployed');
    } else if (!programInfo.executable) {
        throw new Error(`Program is not executable`);
    }
    log.info(`Program ${programId.toBase58()} found`);

}


