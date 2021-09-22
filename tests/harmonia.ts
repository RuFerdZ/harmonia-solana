import * as assert from 'assert';
import * as anchor from '@project-serum/anchor';
import { web3 } from '@project-serum/anchor';

function toSOL(lamport: number) {
    return lamport / web3.LAMPORTS_PER_SOL;
}
function toLamports(sol: number) {
    return sol * web3.LAMPORTS_PER_SOL;
}


describe("harmonia-test-suite", () => {

    let _projectAccount: anchor.web3.Keypair = null;

    const provider = anchor.Provider.env();
    anchor.setProvider(provider);

    const sellerAccount = anchor.web3.Keypair.generate();
    const projectAccount = anchor.web3.Keypair.generate();
    const buyerAccount = anchor.web3.Keypair.generate();

    const program = anchor.workspace.Harmonia;

    console.log(`Connecting to ${provider.connection["_rpcEndpoint"]}`);

    //
    // Helper function that test account balance and request airdrop if less than 'amount'
    //
    async function ensureBalance(publicKey: web3.PublicKey, amount: number) {
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


    it('Print info', async () => {
        const harmoniaBalance = await ensureBalance(provider.wallet.publicKey, 5);
        let sellerWallet = await ensureBalance(sellerAccount.publicKey, 5);
        let buyerWallet = await ensureBalance(buyerAccount.publicKey, 5);
        console.log(`Harmonia wallet is ${provider.wallet.publicKey.toBase58()}`);
        console.log(`Wallet balance is ${toSOL(harmoniaBalance)}`);
        console.log(`Seller account is ${sellerAccount.publicKey.toBase58()}`);
        console.log(`Seller wallet balance is ${toSOL(sellerWallet)}`);
        console.log(`Buyer account is ${buyerAccount.publicKey.toBase58()}`);
        console.log(`Buyer wallet balance is ${toSOL(buyerWallet)}`);
        console.log(`Project account is ${projectAccount.publicKey.toBase58()}`);
        assert.ok(true);
    });


    it('Create a project (500 offsets / 2000 lamports each offset)', async () => {

        const tx = await program.rpc.create(new anchor.BN(500), new anchor.BN(2000), "AmazingSolarFarm", {
            accounts: {
                project: projectAccount.publicKey,
                seller: sellerAccount.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
            },
            signers: [projectAccount, sellerAccount],
        });

        // Fetch the newly created account from the cluster.
        const account = await program.account.project.fetch(projectAccount.publicKey);
        assert.equal(account.name, "AmazingSolarFarm");
        assert.equal(account.availableOffset.toNumber(), 500);
        assert.equal(account.totalOffset.toNumber(), 500);
        assert.equal(account.offsetPrice.toNumber(), 2000);
    });


    it('Buy 10 offsets', async () => {

        const sellerBalance0 = await provider.connection.getBalance(sellerAccount.publicKey);
        const buyerBalance0 = await provider.connection.getBalance(buyerAccount.publicKey);

        const tx = await program.rpc.buy(new anchor.BN(10), {
            accounts: {
                project: projectAccount.publicKey,
                buyer: buyerAccount.publicKey,
                seller: sellerAccount.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
            },
            signers: [buyerAccount],
        });

        // Fetch the project from the cluster.
        const account = await program.account.project.fetch(projectAccount.publicKey);
        assert.equal(account.availableOffset.toNumber(), 490);
        assert.equal(account.totalOffset.toNumber(), 500);
        assert.equal(account.offsetPrice.toNumber(), 2000);

        const sellerBalance1 = await provider.connection.getBalance(sellerAccount.publicKey);
        const buyerBalance1 = await provider.connection.getBalance(buyerAccount.publicKey);
        const sellerTake = sellerBalance1 - sellerBalance0;
        const buyerGive = buyerBalance1 - buyerBalance0;
        const expectedTransfer = 10 * 2000;

        assert.equal(sellerTake, expectedTransfer);
        assert.equal(buyerGive, -expectedTransfer);
    });



});