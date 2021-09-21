import {
    clusterApiUrl, Connection, Keypair, PublicKey, sendAndConfirmTransaction,
    SystemProgram, Transaction
} from '@solana/web3.js';
import log from 'loglevel';
import fs from 'mz/fs';
import os from 'os';
import path from 'path';
import yaml from 'yaml';


// Return default Solana CLI config file (see solana config get)
async function getSolanaCliConfig(): Promise<any> {
    const CONFIG_FILE_PATH = path.resolve(
        os.homedir(),
        '.config',
        'solana',
        'cli',
        'config.yml',
    );
    const configYml = await fs.readFile(CONFIG_FILE_PATH, { encoding: 'utf8' });
    return yaml.parse(configYml);
}

// Return default Solana CLI rpc endpoint
export async function getSolanaCliRpcUrl(): Promise<string> {
    try {
        const config = await getSolanaCliConfig();
        if (!config.json_rpc_url) throw new Error('Missing RPC URL');
        return config.json_rpc_url;
    } catch (err) {
        console.warn(
            'Failed to read RPC url from CLI config file, falling back to localhost',
        );
        return 'http://localhost:8899';
    }
}

// Return initiator Keypair
// If keypairFile == "" return default Solana CLI Keypair
// Else load Keypair at path keypairFile
export async function getInitiator(keypairFile: string): Promise<Keypair> {
    try {
        if (keypairFile == "") {
            const config = await getSolanaCliConfig();
            if (!config.keypair_path) throw new Error('Missing keypair path');
            log.info(`Using Keypair file ${config.keypair_path}`);
            return await createKeypairFromFile(config.keypair_path);
        } else {
            log.info(`Using Keypair file ${keypairFile}`);
            return await createKeypairFromFile(keypairFile);
        }
    } catch (err) {
        log.error('Failed to load keypair');
        return Keypair.generate();
    }
}

// Build Keypair from secret in 'filePath' 
export async function createKeypairFromFile(
    filePath: string,
): Promise<Keypair> {
    const secretKeyString = await fs.readFile(filePath, { encoding: 'utf8' });
    const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
    return Keypair.fromSecretKey(secretKey);
}

// Connect to env specified
// If empty, use the one in Solana CLI config file 
// Else (mainnet-beta, testnet, devnet, localnet)
export async function establishConnection(env: string): Promise<Connection> {
    let rpcUrl: string;
    let connection: Connection;
    if (!env || env == "") {
        log.info('Using default network env.');
        rpcUrl = await getSolanaCliRpcUrl();
        connection = new Connection(rpcUrl, 'confirmed');
    } else if (env == "localnet") {
        rpcUrl = await getSolanaCliRpcUrl();
        connection = new Connection("http://127.0.0.1:8899", 'confirmed');
    } else {
        rpcUrl = env;
        connection = new Connection(clusterApiUrl(env as any));
    }

    const version = await connection.getVersion();
    log.info('Connection to cluster established:', connection["_rpcEndpoint"], version);
    return connection;
}