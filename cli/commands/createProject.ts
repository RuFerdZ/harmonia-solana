import {
    Connection, Keypair
} from '@solana/web3.js';

import * as anchor from '@project-serum/anchor';
import { web3 } from '@project-serum/anchor';

import log from 'loglevel';
import { programId as pid } from '../check';
import { NodeWallet } from '@project-serum/anchor/dist/cjs/provider';


export async function createProject(connection: Connection, initiator: Keypair) {

    log.info(`create project`);

    const wallet = new NodeWallet(initiator);
    const provider = new anchor.Provider(connection, wallet, {
        preflightCommitment: "recent",
        commitment: "recent",
    });

    // Read the generated IDL and create program
    const idl = JSON.parse(require('fs').readFileSync('./target/idl/harmonia.json', 'utf8'));
    const programId = new anchor.web3.PublicKey(pid);
    const program = new anchor.Program(idl, programId, provider);

    const buyerAccount = anchor.web3.Keypair.generate();
    const projectAccount = anchor.web3.Keypair.generate();

    const balance = await provider.connection.getBalance(provider.wallet.publicKey);
    let buyerWallet = await provider.connection.getBalance(buyerAccount.publicKey);
    if (buyerWallet < 2 * web3.LAMPORTS_PER_SOL) {
        console.log(`Requesting airdrop`);
        const signature = await provider.connection.requestAirdrop(buyerAccount.publicKey, 1 * web3.LAMPORTS_PER_SOL);
        const resp = await provider.connection.confirmTransaction(signature);
        if (resp.value.err != null) {
            console.error(`Airdrop failed: ${JSON.stringify(resp.value.err)}`);
        }
        buyerWallet = await provider.connection.getBalance(buyerAccount.publicKey);
    }
    console.log(`Harmonia wallet is ${provider.wallet.publicKey.toBase58()}`);
    console.log(`Wallet balance is ${balance / web3.LAMPORTS_PER_SOL}`);
    console.log(`Buyer account is ${buyerAccount.publicKey.toBase58()}`);
    console.log(`Buyer wallet balance is ${buyerWallet / web3.LAMPORTS_PER_SOL}`);
    console.log(`Project account is ${projectAccount.publicKey.toBase58()}`);
}


