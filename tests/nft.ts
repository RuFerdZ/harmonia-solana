import * as assert from 'assert';
import * as anchor from '@project-serum/anchor';
import { web3 } from '@project-serum/anchor';
import { ensureBalance, getCandyMachine, getCandyProgram, getHarmoniaProgram, initializeCandyMachine, mintNft, updateCandyMachine } from './helper';

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

        const [candyMachine, bump] = await getCandyMachine(config.publicKey, candyMachineUuid, candyProgramId);

        console.log("fire!!!!");

        const tx = await harmoniaProgram.rpc.buyAndMint(new anchor.BN(150), {
            accounts: {
                project: projectAccount.publicKey,
                buyer: buyerAccount.publicKey,
                seller: sellerAccount.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
                candyProgram: candyProgram.programId,
                config: config.publicKey,
                candyMachine: candyMachine,
            },
            signers: [buyerAccount],
        });

        // Fetch the project from the cluster.
        const account = await harmoniaProgram.account.project.fetch(projectAccount.publicKey);
        assert.equal(account.availableOffset.toNumber(), (500 - 10 - 150));
        assert.equal(account.totalOffset.toNumber(), 500);

    });

});