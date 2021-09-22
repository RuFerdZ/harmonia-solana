// import * as assert from 'assert';
// import * as anchor from '@project-serum/anchor';
// import { web3 } from '@project-serum/anchor';

// function toSOL(lamport: number) {
//     return lamport / web3.LAMPORTS_PER_SOL;
// }
// function toLamports(sol: number) {
//     return sol * web3.LAMPORTS_PER_SOL;
// }


// describe("harmonia-test-suite", () => {

//     let _projectAccount: anchor.web3.Keypair = null;

//     const provider = anchor.Provider.env();
//     anchor.setProvider(provider);

//     const sellerAccount = anchor.web3.Keypair.generate();
//     const projectAccount = anchor.web3.Keypair.generate();
//     const buyerAccount = anchor.web3.Keypair.generate();

//     const program = anchor.workspace.Harmonia;

//     console.log(`Connecting to ${provider.connection["_rpcEndpoint"]}`);

//     //
//     // Helper function that test account balance and request airdrop if less than 'amount'
//     //
//     async function ensureBalance(publicKey: web3.PublicKey, amount: number) {
//         let b = await provider.connection.getBalance(publicKey);
//         if (b < amount) {
//             const signature = await provider.connection.requestAirdrop(publicKey, amount * web3.LAMPORTS_PER_SOL);
//             const resp = await provider.connection.confirmTransaction(signature);
//             if (resp.value.err != null) {
//                 console.error(`Airdrop failed: ${JSON.stringify(resp.value.err)}`);
//             }
//             b = await provider.connection.getBalance(publicKey);
//         }
//         return b;
//     }


//     it('Print info', async () => {
//         const harmoniaBalance = await ensureBalance(provider.wallet.publicKey, 5);
//         let sellerWallet = await ensureBalance(sellerAccount.publicKey, 5);
//         let buyerWallet = await ensureBalance(buyerAccount.publicKey, 5);
//         console.log(`Harmonia wallet is ${provider.wallet.publicKey.toBase58()}`);
//         console.log(`Wallet balance is ${toSOL(harmoniaBalance)}`);
//         console.log(`Seller account is ${sellerAccount.publicKey.toBase58()}`);
//         console.log(`Seller wallet balance is ${toSOL(sellerWallet)}`);
//         console.log(`Buyer account is ${buyerAccount.publicKey.toBase58()}`);
//         console.log(`Buyer wallet balance is ${toSOL(buyerWallet)}`);
//         console.log(`Project account is ${projectAccount.publicKey.toBase58()}`);
//         assert.ok(true);
//     });


//     it('Create a project', async () => {

//         const harmoniaWallet0 = await provider.connection.getBalance(provider.wallet.publicKey);
//         const sellerWallet0 = await provider.connection.getBalance(sellerAccount.publicKey);

//         const tx = await program.rpc.create("TheProjectDeOuf", {
//             accounts: {
//                 project: projectAccount.publicKey,
//                 seller: sellerAccount.publicKey,
//                 harmonia: provider.wallet.publicKey,
//                 systemProgram: anchor.web3.SystemProgram.programId,
//             },
//             signers: [projectAccount, sellerAccount],
//         });

//         // Fetch the newly created account from the cluster.
//         const account = await program.account.project.fetch(projectAccount.publicKey);

//         const harmoniaWallet = await provider.connection.getBalance(provider.wallet.publicKey);
//         const sellerWallet = await provider.connection.getBalance(sellerAccount.publicKey);
//         const projectWallet = await provider.connection.getBalance(projectAccount.publicKey);
//         const harmoniaWalletDiff = toSOL(harmoniaWallet - harmoniaWallet0);
//         const sellerDiff = toSOL(sellerWallet - sellerWallet0);
//         console.log(`Harmonia wallet balance is ${toSOL(harmoniaWallet)}, diff : ${harmoniaWalletDiff}`);
//         console.log(`Buyer wallet balance is ${toSOL(sellerWallet)}, diff : ${sellerDiff}`);

//         assert.ok(account.name == "TheProjectDeOuf");
//         assert.ok(harmoniaWalletDiff >= 0.99);
//         assert.ok(sellerDiff <= -1);
//     });


//     it('Buy some offset', async () => {

//         const harmoniaWallet0 = await provider.connection.getBalance(provider.wallet.publicKey);
//         const buyerWallet0 = await provider.connection.getBalance(buyerAccount.publicKey);
//         const projectWallet0 = await provider.connection.getBalance(projectAccount.publicKey);

//         const tx = await program.rpc.buy(new anchor.BN(2 * web3.LAMPORTS_PER_SOL), {
//             accounts: {
//                 project: projectAccount.publicKey,
//                 buyer: buyerAccount.publicKey,
//                 harmonia: provider.wallet.publicKey,
//                 systemProgram: anchor.web3.SystemProgram.programId,
//             },
//             signers: [buyerAccount],
//         });

//     });

// });