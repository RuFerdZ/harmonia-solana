import * as assert from 'assert';
import * as anchor from '@project-serum/anchor';
import { web3 } from '@project-serum/anchor';
import { ensureBalance, getCandyMachine, getOwnedTokenAccounts, initializeCandyMachine, mintNft, updateCandyMachine } from './helper';

function toSOL(lamport: number) {
    return lamport / web3.LAMPORTS_PER_SOL;
}



describe("candy-test-suite", () => {

    const provider = anchor.Provider.env();
    anchor.setProvider(provider);

    //const program = anchor.workspace.CandyMachine;
    const idl = JSON.parse(require('fs').readFileSync('./target/idl/candy_machine.json', 'utf8'));
    const program = new anchor.Program(idl, new web3.PublicKey("CANHaiDd6HPK3ykgunmXFNZMrZ4KbZgEidY5US2L8CTw"), provider) as any;

    const candyProgramId: web3.PublicKey = program.programId;
    const myWallet = provider.wallet["payer"] as web3.Keypair;


    console.log(`Connecting to ${provider.connection["_rpcEndpoint"]}`);

    it('Print info', async () => {
        const harmoniaBalance = await ensureBalance(provider, provider.wallet.publicKey, 2);
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
        assert.ok(machine.authority.equals(myWallet.publicKey));
        assert.equal(machine.bump, bump);

        const config = await program.account.config.fetch(init.config.publicKey);
        assert.equal(config.data.sellerFeeBasisPoints, new anchor.BN(500));
    });


    it('Mint 1 nft', async () => {

        const payer = await anchor.web3.Keypair.generate();
        const payerBalance = await ensureBalance(provider, payer.publicKey, 1);

        const init = await initializeCandyMachine(provider, program, myWallet);

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

        // mint another one
        await mintNft(provider, program, candyMachine, init.config.publicKey, payer, myWallet.publicKey);

        tokens = await getOwnedTokenAccounts(provider.connection, payer.publicKey);
        assert.equal(tokens.length, 2);
    });

});