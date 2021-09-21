import * as assert from 'assert';
import * as anchor from '@project-serum/anchor';
import { web3 } from '@project-serum/anchor';

describe("basic-1", () => {

    let _projectAccount: anchor.web3.Keypair = null;

    const provider = anchor.Provider.env();
    anchor.setProvider(provider);
    const buyerAccount = anchor.web3.Keypair.generate();
    const projectAccount = anchor.web3.Keypair.generate();

    const program = anchor.workspace.Harmonia;

    console.log(`Connecting to ${provider.connection["_rpcEndpoint"]}`);

    it('Print info', async () => {
        const balance = await provider.connection.getBalance(provider.wallet.publicKey);
        let buyerWallet = await provider.connection.getBalance(buyerAccount.publicKey);
        if (buyerWallet < 2 * web3.LAMPORTS_PER_SOL) {
            console.log(`Requesting airdrop`);
            const signature = await provider.connection.requestAirdrop(buyerAccount.publicKey, 5 * web3.LAMPORTS_PER_SOL);
            const resp = await provider.connection.confirmTransaction(signature);
            if(resp.value.err != null) {
                console.error(`Airdrop failed: ${JSON.stringify(resp.value.err)}`);
            }
            buyerWallet = await provider.connection.getBalance(buyerAccount.publicKey);
        }
        console.log(`Harmonia wallet is ${provider.wallet.publicKey.toBase58()}`);
        console.log(`Wallet balance is ${balance / web3.LAMPORTS_PER_SOL}`);
        console.log(`Buyer account is ${buyerAccount.publicKey.toBase58()}`);
        console.log(`Buyer wallet balance is ${buyerWallet / web3.LAMPORTS_PER_SOL}`);
        console.log(`Project account is ${projectAccount.publicKey.toBase58()}`);
        assert.ok(true);
    });


    it('Create a project', async () => {

        const tx = await program.rpc.create("TheProjectDeOuf", {
            accounts: {
                project: projectAccount.publicKey,
                payer: buyerAccount.publicKey,
                harmonia: provider.wallet.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
            },
            signers: [projectAccount, buyerAccount],
        });
        console.log(`Your transaction signature is ${tx}`);

        // Fetch the newly created account from the cluster.
        const account = await program.account.project.fetch(projectAccount.publicKey);
        console.log(`Data fetch from project ${account.name}`);

        const balance = await provider.connection.getBalance(provider.wallet.publicKey);
        const buyerWallet = await provider.connection.getBalance(buyerAccount.publicKey);
        console.log(`Harmonia wallet balance is ${balance / web3.LAMPORTS_PER_SOL}`);
        console.log(`Buyer wallet balance is ${buyerWallet / web3.LAMPORTS_PER_SOL}`);

        assert.ok(account.name == "TheProjectDeOuf");
    });


});