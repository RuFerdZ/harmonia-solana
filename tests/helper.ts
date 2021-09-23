import * as assert from 'assert';
import * as anchor from '@project-serum/anchor';
import { web3 } from '@project-serum/anchor';

import {
    PublicKey,
    SystemProgram,
    SYSVAR_RENT_PUBKEY,
    TransactionInstruction,
} from "@solana/web3.js";
import { MintLayout, Token } from '@solana/spl-token';

//
// Helper function that test account balance and request airdrop if less than 'amount'
//
export async function ensureBalance(provider: anchor.Provider, publicKey: web3.PublicKey, amount: number) {
    let b = await provider.connection.getBalance(publicKey);
    if (b < amount) {
        const signature = await provider.connection.requestAirdrop(publicKey, amount * web3.LAMPORTS_PER_SOL);
        const resp = await provider.connection.confirmTransaction(signature);
        if (resp.value.err != null) {
            console.error(`Airdrop failed: ${JSON.stringify(resp.value.err)}`);
        }
        b = await provider.connection.getBalance(publicKey);
    }
    return b;
}




//
// Candy machine creation
//

//
export async function getInitializeConfigTx(program: anchor.Program, myWallet: web3.Keypair, lines: number) {
    const authority = anchor.web3.Keypair.generate();
    const config = await anchor.web3.Keypair.generate();
    const uuid = anchor.web3.Keypair.generate().publicKey.toBase58().slice(0, 6);

    let tx = await program.instruction.initializeConfig(
        {
            uuid: uuid,
            maxNumberOfLines: new anchor.BN(lines),
            symbol: "SYMBOL",
            sellerFeeBasisPoints: 500,
            isMutable: true,
            maxSupply: new anchor.BN(0),
            retainAuthority: false,
            creators: [
                { address: myWallet.publicKey, verified: false, share: 100 },
            ],
        },
        {
            accounts: {
                config: config.publicKey,
                authority: authority.publicKey,
                payer: myWallet.publicKey,
                rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            },
            signers: [myWallet, config],
        }
    ) as TransactionInstruction;

    return {
        uuid,
        authority,
        config,
        tx
    }
};

export async function addConfigLines(program: anchor.Program, myWallet: web3.Keypair, lines: number, authority: web3.Keypair, config: web3.Keypair): Promise<TransactionInstruction> {
    const firstVec = [];
    for (let i = 0; i < lines; i++) {
        firstVec.push({
            uri: `www.aol.com/${i}`,
            isMutable: true,
            name: `Sample ${i}`
        });
    }

    const tx1 = await program.instruction.addConfigLines(0, firstVec, {
        accounts: {
            config: config.publicKey,
            authority: authority.publicKey,
        },
        signers: [authority, myWallet],
    }) as TransactionInstruction;
    return tx1;
};

export const CANDY_MACHINE = "candy_machine";
export const configArrayStart =
    32 + // authority
    4 +
    6 + // uuid + u32 len
    4 +
    10 + // u32 len + symbol
    2 + // seller fee basis points
    1 +
    4 +
    5 * 34 + // optional + u32 len + actual vec
    8 + //max supply
    1 + //is mutable
    1 + // retain authority
    4; // max number of lines;
export const configLineSize = 4 + 32 + 4 + 200;

export async function getCandyMachine(config: anchor.web3.PublicKey, uuid: string, candyProgramId: web3.PublicKey) {
    return await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from(CANDY_MACHINE), config.toBuffer(), Buffer.from(uuid)],
        candyProgramId
    );
};


export async function initializeCandyMachine(provider: anchor.Provider, program: anchor.Program, myWallet: web3.Keypair) {
    const initConfig = await getInitializeConfigTx(program, myWallet, 5);
    const { authority, config } = initConfig;

    const addLinesTx = await addConfigLines(program, myWallet, 5, authority, config);

    const candyMachineUuid = anchor.web3.Keypair.generate().publicKey.toBase58().slice(0, 6);
    const [candyMachine, bump] = await getCandyMachine(config.publicKey, candyMachineUuid, program.programId);

    const accountSize = configArrayStart + 4 + 5 * configLineSize + 4 + 2;
    const accountLamports = await provider.connection.getMinimumBalanceForRentExemption(accountSize);

    await program.rpc.initializeCandyMachine(
        bump,
        {
            uuid: candyMachineUuid,
            price: new anchor.BN(0.05 * web3.LAMPORTS_PER_SOL),
            itemsAvailable: new anchor.BN(5),
            goLiveDate: null,
        },
        {
            accounts: {
                candyMachine,
                wallet: myWallet.publicKey,
                config: config.publicKey,
                authority: authority.publicKey,
                payer: myWallet.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
                rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            },
            signers: [myWallet, authority, config],
            instructions: [
                anchor.web3.SystemProgram.createAccount({
                    fromPubkey: myWallet.publicKey,
                    newAccountPubkey: config.publicKey,
                    space: accountSize,
                    lamports: accountLamports,
                    programId: program.programId,
                }),
                anchor.web3.SystemProgram.transfer({
                    fromPubkey: myWallet.publicKey,
                    toPubkey: authority.publicKey,
                    lamports: 5,
                }),
                initConfig.tx, // initializeConfig
                addLinesTx, // addConfigLines
            ],
        }
    );

    return {
        config,
        authority,
        candyMachine,
        candyMachineUuid
    }
}

//
// Candy machine mint
//
const TOKEN_PROGRAM_ID = new PublicKey(
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
);
const SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID = new PublicKey(
    "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
);
const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
    "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

export async function getTokenWalletAddress(wallet: PublicKey, mint: PublicKey) {
    return (
        await PublicKey.findProgramAddress([wallet.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()], SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID)
    )[0];
}
export async function getMetadataAddress(mint: anchor.web3.PublicKey): Promise<anchor.web3.PublicKey> {
    return (
        await anchor.web3.PublicKey.findProgramAddress([Buffer.from("metadata"), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer(),], TOKEN_METADATA_PROGRAM_ID)
    )[0];
};

export async function mintNft(provider: anchor.Provider, program: anchor.Program, candyMachineAddress: web3.PublicKey, configAddress: web3.PublicKey, authority: web3.Keypair, myWallet: web3.Keypair) {
    const mint = anchor.web3.Keypair.generate();
    const token = await getTokenWalletAddress(authority.publicKey, mint.publicKey);
    const metadata = await getMetadataAddress(mint.publicKey);

    const tx = await program.rpc.mintNft({
        accounts: {
            config: configAddress,
            candyMachine: candyMachineAddress,
            payer: authority.publicKey,
            wallet: myWallet.publicKey,
            mint: mint.publicKey,
            metadata,
            // masterEdition,
            mintAuthority: authority.publicKey,
            updateAuthority: authority.publicKey,
            tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        },
        signers: [mint, authority, myWallet],
        instructions: [
            // Give authority enough to pay off the cost of the nft!
            // it'll be funnneled right back
            anchor.web3.SystemProgram.transfer({
                fromPubkey: myWallet.publicKey,
                toPubkey: authority.publicKey,
                lamports: 1000000000 + 10000000, // add minting fees in there
            }),
            anchor.web3.SystemProgram.createAccount({
                fromPubkey: myWallet.publicKey,
                newAccountPubkey: mint.publicKey,
                space: MintLayout.span,
                lamports: await provider.connection.getMinimumBalanceForRentExemption(MintLayout.span),
                programId: TOKEN_PROGRAM_ID,
            }),
            Token.createInitMintInstruction(
                TOKEN_PROGRAM_ID,
                mint.publicKey,
                0,
                authority.publicKey,
                authority.publicKey
            ),
            createAssociatedTokenAccountInstruction(
                token,
                myWallet.publicKey,
                authority.publicKey,
                mint.publicKey
            ),
            Token.createMintToInstruction(
                TOKEN_PROGRAM_ID,
                mint.publicKey,
                token,
                authority.publicKey,
                [],
                1
            ),
        ],
    });
}

export function createAssociatedTokenAccountInstruction(
    associatedTokenAddress: PublicKey,
    payer: PublicKey,
    walletAddress: PublicKey,
    splTokenMintAddress: PublicKey
) {
    const keys = [
        { pubkey: payer, isSigner: true, isWritable: true, },
        { pubkey: associatedTokenAddress, isSigner: false, isWritable: true, },
        { pubkey: walletAddress, isSigner: false, isWritable: false, },
        { pubkey: splTokenMintAddress, isSigner: false, isWritable: false, },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false, },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false, },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false, },
    ];
    return new TransactionInstruction({
        keys,
        programId: SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
        data: Buffer.from([]),
    });
}