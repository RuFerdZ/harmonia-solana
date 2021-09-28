import * as assert from 'assert';
import * as anchor from '@project-serum/anchor';
import { web3 } from '@project-serum/anchor';
import { ensureBalance, getCandyMachine, getCandyProgram, getMasterEditionAddress, getMetadataAddress, getOwnedTokenAccounts, getTokenWalletAddress, initializeCandyMachine, mintNft, TOKEN_METADATA_PROGRAM_ID, updateCandyMachine } from './helper';
import { SystemProgram } from '@solana/web3.js'
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token';

function toSOL(lamport: number) {
    return lamport / web3.LAMPORTS_PER_SOL;
}



describe("candy-test-suite", () => {

    const provider = anchor.Provider.env();
    anchor.setProvider(provider);

    const program = getCandyProgram(provider);

    const candyProgramId: web3.PublicKey = program.programId;
    const myWallet = provider.wallet["payer"] as web3.Keypair;


    console.log(`Connecting to ${provider.connection["_rpcEndpoint"]}`);

    before('Print info', async () => {
        const harmoniaBalance = await ensureBalance(provider, provider.wallet.publicKey, 2);
        console.log(`Harmonia wallet is ${provider.wallet.publicKey.toBase58()}`);

        assert.ok(true);
    });

    it('Create and initialize candy machine', async () => {

        const init = await initializeCandyMachine(provider, program, myWallet, 5);

        const [candyMachine, bump] = await getCandyMachine(init.config.publicKey, init.candyMachineUuid, candyProgramId);

        const machine = await program.account.candyMachine.fetch(candyMachine);
        assert.equal(machine.data.uuid, init.candyMachineUuid);
        assert.ok(machine.wallet.equals(myWallet.publicKey));
        assert.ok(machine.config.equals(init.config.publicKey));
        assert.ok(machine.authority.equals(myWallet.publicKey));
        assert.equal(machine.bump, bump);

        const config = await program.account.config.fetch(init.config.publicKey);
        assert.equal(config.data.sellerFeeBasisPoints, new anchor.BN(500));
    });


    it('Mint 1 nft', async () => {

        const payer = await anchor.web3.Keypair.generate();
        const payerBalance = await ensureBalance(provider, payer.publicKey, 1);

        const init = await initializeCandyMachine(provider, program, myWallet, 5);

        const [candyMachine, bump] = await getCandyMachine(init.config.publicKey, init.candyMachineUuid, candyProgramId);

        const machine = await program.account.candyMachine.fetch(candyMachine);
        assert.equal(machine.data.uuid, init.candyMachineUuid);
        assert.ok(machine.wallet.equals(myWallet.publicKey));
        assert.ok(machine.itemsRedeemed.eq(new anchor.BN(0)));
        assert.ok(machine.data.itemsAvailable.eq(new anchor.BN(5)));

        const config = await program.account.config.fetch(init.config.publicKey);
        assert.equal(config.data.sellerFeeBasisPoints, new anchor.BN(500));

        await updateCandyMachine(program, candyMachine, myWallet, null, 0);

        const res = await mintNft(provider, program, candyMachine, init.config.publicKey, payer, myWallet.publicKey);

        const machine2 = await program.account.candyMachine.fetch(candyMachine);
        assert.ok(machine2.itemsRedeemed.eq(new anchor.BN(1)));
        assert.ok(machine2.data.itemsAvailable.eq(new anchor.BN(5)));

        let tokens = await getOwnedTokenAccounts(provider.connection, payer.publicKey);
        assert.equal(tokens.length, 1);
        assert.equal(res.mint.publicKey, tokens[0].accountInfo.mint);
        console.log(`NFT: ${tokens[0].publicKey}, Payer: ${payer.publicKey}, Mint: ${res.mint.publicKey}`);

        // mint another one
        await mintNft(provider, program, candyMachine, init.config.publicKey, payer, myWallet.publicKey);

        tokens = await getOwnedTokenAccounts(provider.connection, payer.publicKey);
        assert.equal(tokens.length, 2);
    });


    it('Mint (simple) 1 nft', async () => {

        const payer = await anchor.web3.Keypair.generate();
        const payerBalance = await ensureBalance(provider, payer.publicKey, 1);

        const init = await initializeCandyMachine(provider, program, myWallet, 5);
        const [candyMachine, bump] = await getCandyMachine(init.config.publicKey, init.candyMachineUuid, candyProgramId);
        const machine = await program.account.candyMachine.fetch(candyMachine);
        assert.equal(machine.data.uuid, init.candyMachineUuid);
        assert.ok(machine.wallet.equals(myWallet.publicKey));
        assert.ok(machine.itemsRedeemed.eq(new anchor.BN(0)));

        await updateCandyMachine(program, candyMachine, myWallet, null, 0);


        const mint = anchor.web3.Keypair.generate();
        const token = await getTokenWalletAddress(payer.publicKey, mint.publicKey);
        const metadata = await getMetadataAddress(mint.publicKey);
        const masterEdition = await getMasterEditionAddress(mint.publicKey);

        const tx = await program.rpc.mintOne({
            accounts: {
                config: init.config.publicKey,
                candyMachine: candyMachine,
                payer: payer.publicKey,
                wallet: myWallet.publicKey, // treasury
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
            signers: [mint, payer],
        });

        const machine2 = await program.account.candyMachine.fetch(candyMachine);
        assert.ok(machine2.itemsRedeemed.eq(new anchor.BN(1)));

        let tokens = await getOwnedTokenAccounts(provider.connection, payer.publicKey);
        assert.equal(tokens.length, 1);
        assert.equal(mint.publicKey, tokens[0].accountInfo.mint);
        console.log(`NFT: ${tokens[0].publicKey}, Payer: ${payer.publicKey}, Mint: ${mint.publicKey}`);
    });


    it('Ping', async () => {
        const init = await initializeCandyMachine(provider, program, myWallet, 5);
        const [candyMachine, bump] = await getCandyMachine(init.config.publicKey, init.candyMachineUuid, candyProgramId);

        const tx = await program.rpc.ping(
            new anchor.BN(255),
            {
                accounts: {
                    candyMachine: candyMachine,
                    authority: myWallet.publicKey,
                },
            },
        );

        assert.ok(true);
    });

});