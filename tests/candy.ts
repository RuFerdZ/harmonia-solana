import * as assert from 'assert';
import * as anchor from '@project-serum/anchor';
import { web3 } from '@project-serum/anchor';
import { ensureBalance, getCandyMachine, initializeCandyMachine, mintNft } from './helper';

function toSOL(lamport: number) {
    return lamport / web3.LAMPORTS_PER_SOL;
}



describe("candy-test-suite", () => {

    const provider = anchor.Provider.env();
    anchor.setProvider(provider);

    const program = anchor.workspace.CandyMachine;
    const candyProgramId: web3.PublicKey = program.programId;
    const myWallet = provider.wallet["payer"] as web3.Keypair;

    console.log(`Connecting to ${provider.connection["_rpcEndpoint"]}`);

    it('Print info', async () => {
        const harmoniaBalance = await ensureBalance(provider, provider.wallet.publicKey, 5);
        console.log(`Harmonia wallet is ${provider.wallet.publicKey.toBase58()}`);
        assert.ok(true);
    });

    it('Create and initialize candy machine', async () => {

        const init = await initializeCandyMachine(provider, program, myWallet);

        const [candyMachine, bump] = await getCandyMachine(init.config.publicKey, init.candyMachineUuid, candyProgramId);

        const machine = await program.account.candyMachine.fetch(candyMachine);
        assert.equal(machine.data.uuid, init.candyMachineUuid);
        assert.ok(machine.wallet.equals(myWallet.publicKey));
        assert.ok(machine.config.equals(init.config.publicKey));
        assert.ok(machine.authority.equals(init.authority.publicKey));
        assert.equal(machine.bump, bump);

        const config = await program.account.config.fetch(init.config.publicKey);
        assert.equal(config.data.sellerFeeBasisPoints, new anchor.BN(500));
    });


    it('Mint 1 nft', async () => {

        const init = await initializeCandyMachine(provider, program, myWallet);

        const [candyMachine, bump] = await getCandyMachine(init.config.publicKey, init.candyMachineUuid, candyProgramId);

        const machine = await program.account.candyMachine.fetch(candyMachine);
        assert.equal(machine.data.uuid, init.candyMachineUuid);
        assert.ok(machine.wallet.equals(myWallet.publicKey));

        const config = await program.account.config.fetch(init.config.publicKey);
        assert.equal(config.data.sellerFeeBasisPoints, new anchor.BN(500));

        mintNft(provider, program, candyMachine, init.config.publicKey, init.authority, myWallet);

        assert.ok(true);
    });

});