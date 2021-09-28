import * as assert from 'assert';
import * as anchor from '@project-serum/anchor';
import { web3 } from '@project-serum/anchor';
import { ensureBalance, getCandyMachine, getCandyProgram, getHarmoniaProgram, getMasterEditionAddress, getMetadataAddress, getOwnedTokenAccounts, getTokenWalletAddress, initializeCandyMachine, mintNft, TOKEN_METADATA_PROGRAM_ID, updateCandyMachine } from './helper';
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { program } from 'commander';
import { SystemProgram } from '@solana/web3.js'

function toSOL(lamport: number) {
    return lamport / web3.LAMPORTS_PER_SOL;
}


describe("nft-test-suite", () => {

    const provider = anchor.Provider.env();
    anchor.setProvider(provider);
    const myWallet = provider.wallet["payer"] as web3.Keypair;

    const sellerAccount = anchor.web3.Keypair.generate();
    const projectAccount = anchor.web3.Keypair.generate();
    const buyerAccount = anchor.web3.Keypair.generate();

    const harmoniaProgram = getHarmoniaProgram(provider);
    const candyProgram = getCandyProgram(provider);
    const candyProgramId: web3.PublicKey = candyProgram.programId;

    console.log(`Connecting to ${provider.connection["_rpcEndpoint"]}`);

    let config: web3.Keypair = null;
    let candyMachineUuid: string = null;
    let machineState: any = null;

    before('Print info', async () => {
        const harmoniaBalance = await ensureBalance(provider, provider.wallet.publicKey, 5);
        let sellerWallet = await ensureBalance(provider, sellerAccount.publicKey, 5);
        let buyerWallet = await ensureBalance(provider, buyerAccount.publicKey, 5);
    });


    it('Create a project + candymachine', async () => {

        await harmoniaProgram.rpc.create(new anchor.BN(500), new anchor.BN(2000), "AmazingSolarFarm", {
            accounts: {
                project: projectAccount.publicKey,
                seller: sellerAccount.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
            },
            signers: [projectAccount, sellerAccount],
        });

        // Fetch the newly created account from the cluster.
        const account = await harmoniaProgram.account.project.fetch(projectAccount.publicKey);
        assert.equal(account.totalOffset.toNumber(), 500);

        // Create candy machine and set start date
        const res = await initializeCandyMachine(provider, candyProgram, sellerAccount, 10);
        config = res.config;
        candyMachineUuid = res.candyMachineUuid;

        const [candyMachine, bump] = await getCandyMachine(config.publicKey, candyMachineUuid, candyProgramId);
        await updateCandyMachine(candyProgram, candyMachine, sellerAccount, null, 0);


    });


    it('Buyer mint 1 directly', async () => {

        const [candyMachine, bump] = await getCandyMachine(config.publicKey, candyMachineUuid, candyProgramId);
        const res = await mintNft(provider, candyProgram, candyMachine, config.publicKey, buyerAccount, sellerAccount.publicKey);

        machineState = await candyProgram.account.candyMachine.fetch(candyMachine);
        assert.ok(machineState.itemsRedeemed.eq(new anchor.BN(1)));
        assert.ok(machineState.data.itemsAvailable.eq(new anchor.BN(10)));

        // let tokens = await getOwnedTokenAccounts(provider.connection, payer.publicKey);
        // assert.equal(tokens.length, 1);
        // assert.equal(res.mint.publicKey, tokens[0].accountInfo.mint);
    });



    it('Buy 10 offsets directly', async () => {

        const tx = await harmoniaProgram.rpc.buy(new anchor.BN(10), {
            accounts: {
                project: projectAccount.publicKey,
                buyer: buyerAccount.publicKey,
                seller: sellerAccount.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
            },
            signers: [buyerAccount],
        });

        // Fetch the project from the cluster.
        const account = await harmoniaProgram.account.project.fetch(projectAccount.publicKey);
        assert.equal(account.availableOffset.toNumber(), (500 - 10));
        assert.equal(account.totalOffset.toNumber(), 500);
    });

    it('Buy and mint', async () => {

        // const [candyMachine, bump] = await getCandyMachine(config.publicKey, candyMachineUuid, candyProgramId);
        // const tx = await harmoniaProgram.rpc.buyAndMint(new anchor.BN(150), {
        //     accounts: {
        //         project: projectAccount.publicKey,
        //         buyer: buyerAccount.publicKey,
        //         seller: sellerAccount.publicKey,
        //         systemProgram: anchor.web3.SystemProgram.programId,
        //         candyProgram: candyProgram.programId,
        //         config: config.publicKey,
        //         candyMachine: candyMachine,
        //     },
        //     signers: [buyerAccount],
        // });
        
        const [candyMachine, bump] = await getCandyMachine(config.publicKey, candyMachineUuid, candyProgramId);
        machineState = await candyProgram.account.candyMachine.fetch(candyMachine);
        assert.ok(machineState.itemsRedeemed.eq(new anchor.BN(1)));

        const mint = anchor.web3.Keypair.generate();
        const token = await getTokenWalletAddress(buyerAccount.publicKey, mint.publicKey);
        const metadata = await getMetadataAddress(mint.publicKey);
        const masterEdition = await getMasterEditionAddress(mint.publicKey);

        const tx = await harmoniaProgram.rpc.buyAndMint(new anchor.BN(10), {
            accounts: {
                project: projectAccount.publicKey,
                buyer: buyerAccount.publicKey,
                seller: sellerAccount.publicKey,
                candyProgram: candyProgram.programId,

                config: config.publicKey,
                candyMachine: candyMachine,
                payer: buyerAccount.publicKey,
                wallet: sellerAccount.publicKey, // treasury
                mint: mint.publicKey,
                associatedToken: token,
                metadata: metadata,
                masterEdition: masterEdition,
                tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
                ataProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
                rent: anchor.web3.SYSVAR_RENT_PUBKEY,
                clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
            },
            signers: [mint, buyerAccount],
        });

        machineState = await candyProgram.account.candyMachine.fetch(candyMachine);
        assert.ok(machineState.itemsRedeemed.eq(new anchor.BN(2)));

        let tokens = await getOwnedTokenAccounts(provider.connection, buyerAccount.publicKey);
        assert.equal(tokens.length, 2);
        assert.equal(mint.publicKey.toBase58(), tokens[1].accountInfo.mint);

    });

});