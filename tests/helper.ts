import * as assert from 'assert';
import * as anchor from '@project-serum/anchor';
import { web3 } from '@project-serum/anchor';

import {
    PublicKey,
    SystemProgram,
    SYSVAR_RENT_PUBKEY,
    TransactionInstruction,
} from "@solana/web3.js";

import { AccountLayout, MintLayout, Token } from '@solana/spl-token';

//
// Helper function that test account balance and request airdrop if less than 'amount'
//
export async function ensureBalance(provider: anchor.Provider, publicKey: web3.PublicKey, amount: number) {
    let b = await provider.connection.getBalance(publicKey);
    if (b < amount) {
        const signature = await provider.connection.requestAirdrop(publicKey, 1.5 * amount * web3.LAMPORTS_PER_SOL);
        const resp = await provider.connection.confirmTransaction(signature);
        if (resp.value.err != null) {
            console.error(`Airdrop failed: ${JSON.stringify(resp.value.err)}`);
        }
        b = await provider.connection.getBalance(publicKey);
    }
    return b;
}


//
// Querying blockchain
//
export function getOwnedAccountsFilters(publicKey: web3.PublicKey) {
    return [
        {
            "encoding": "jsonParsed",
            memcmp: {
                offset: AccountLayout.offsetOf('owner'),
                bytes: publicKey.toBase58(),
            },
        },
        {
            dataSize: AccountLayout.span,
        },
    ]
}

export async function getOwnedTokenAccounts(
    connection: web3.Connection,
    publicKey: web3.PublicKey,
)
/*: Promise<Array<{ publicKey: PublicKey; accountInfo: AccountInfo<Buffer> }>>*/ {
    // let filters = getOwnedAccountsFilters(publicKey);
    // let resp = await connection.getProgramAccounts(
    //     TOKEN_PROGRAM_ID,
    //     {
    //         filters,
    //     },
    //     );
    //     let data = resp
    //     .map(({ pubkey, account: { data, executable, owner, lamports } }) => ({
    //         publicKey: new PublicKey(pubkey),
    //         accountInfo: {
    //             data,
    //             executable,
    //             owner: new PublicKey(owner),
    //             lamports,
    //         },
    //     }));
    let resp = await connection.getParsedTokenAccountsByOwner(publicKey, { programId: TOKEN_PROGRAM_ID });
    let data = resp.value.map(({ pubkey, account }) => {
        return {
            publicKey: new PublicKey(pubkey),
            accountInfo: {
                mint: account.data.parsed.info.mint,
                amount: account.data.parsed.info.tokenAmount.amount,
                decimals: account.data.parsed.info.tokenAmount.decimals
            }
        }
    });
    return data;
}



//
// Candy machine creation
//

//
export async function getInitializeConfigTx(program: anchor.Program, myWallet: web3.Keypair, lines: number) {
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
            retainAuthority: true,
            creators: [
                { address: myWallet.publicKey, verified: false, share: 100 },
            ],
        },
        {
            accounts: {
                config: config.publicKey,
                authority: myWallet.publicKey,
                payer: myWallet.publicKey,
                rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            },
            signers: [myWallet, config],
        }
    ) as TransactionInstruction;

    return {
        uuid,
        config,
        tx
    }
};

export async function addConfigLines(program: anchor.Program, myWallet: web3.Keypair, lines: number, config: web3.Keypair): Promise<TransactionInstruction> {
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
            authority: myWallet.publicKey,
        },
        signers: [myWallet],
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
    const { config } = initConfig;

    const addLinesTx = await addConfigLines(program, myWallet, 5, config);

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
                authority: myWallet.publicKey,
                payer: myWallet.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
                rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            },
            signers: [myWallet, config],
            instructions: [
                anchor.web3.SystemProgram.createAccount({
                    fromPubkey: myWallet.publicKey,
                    newAccountPubkey: config.publicKey,
                    space: accountSize,
                    lamports: accountLamports,
                    programId: program.programId,
                }),
                // anchor.web3.SystemProgram.transfer({
                //     fromPubkey: myWallet.publicKey,
                //     toPubkey: authority.publicKey,
                //     lamports: 5,
                // }),
                initConfig.tx, // initializeConfig
                addLinesTx, // addConfigLines
            ],
        }
    );

    return {
        config,
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
    const adr = await PublicKey.findProgramAddress([wallet.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()], SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID)
    return adr[0];
}
export async function getMetadataAddress(mint: anchor.web3.PublicKey): Promise<anchor.web3.PublicKey> {
    const adr = await anchor.web3.PublicKey.findProgramAddress([Buffer.from("metadata"), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer(),], TOKEN_METADATA_PROGRAM_ID)
    return adr[0];
};
export async function getMasterEditionAddress(mint: anchor.web3.PublicKey): Promise<anchor.web3.PublicKey> {
    const adr = await anchor.web3.PublicKey.findProgramAddress([Buffer.from("metadata"), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer(), Buffer.from("edition"),], TOKEN_METADATA_PROGRAM_ID)
    return adr[0];
};

export async function mintNft(provider: anchor.Provider, program: anchor.Program, candyMachineAddress: web3.PublicKey, configAddress: web3.PublicKey, payer: web3.Keypair, myWallet: web3.PublicKey) {
    const mint = anchor.web3.Keypair.generate();
    const token = await getTokenWalletAddress(payer.publicKey, mint.publicKey);
    const metadata = await getMetadataAddress(mint.publicKey);
    const masterEdition = await getMasterEditionAddress(mint.publicKey);

    const tx = await program.rpc.mintNft({
        accounts: {
            config: configAddress,
            candyMachine: candyMachineAddress,
            payer: payer.publicKey,
            wallet: myWallet, // treasury
            mint: mint.publicKey,
            metadata,
            masterEdition,
            mintAuthority: payer.publicKey,
            updateAuthority: payer.publicKey,
            tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        },
        signers: [mint, payer],
        instructions: [
            anchor.web3.SystemProgram.createAccount({
                fromPubkey: payer.publicKey,
                newAccountPubkey: mint.publicKey,
                space: MintLayout.span,
                lamports: await provider.connection.getMinimumBalanceForRentExemption(MintLayout.span),
                programId: TOKEN_PROGRAM_ID,
            }),
            Token.createInitMintInstruction(
                TOKEN_PROGRAM_ID,
                mint.publicKey,
                0,
                payer.publicKey,
                payer.publicKey
            ),
            createAssociatedTokenAccountInstruction(
                token,
                payer.publicKey,
                payer.publicKey,
                mint.publicKey
            ),
            Token.createMintToInstruction(
                TOKEN_PROGRAM_ID,
                mint.publicKey,
                token,
                payer.publicKey,
                [],
                1
            ),
        ],
    });

    return {
        tx,
        mint
    };
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


export async function updateCandyMachine(program: anchor.Program, candyMachineAddress: web3.PublicKey, myWallet: web3.Keypair, lamports: number, secondsSinceEpoch: number) {
    const tx = await program.rpc.updateCandyMachine(
        lamports != null ? new anchor.BN(lamports) : null,
        secondsSinceEpoch != null ? new anchor.BN(secondsSinceEpoch) : null,
        {
            accounts: {
                candyMachine: candyMachineAddress,
                authority: myWallet.publicKey,
            },
        },
    );
    return tx;
}