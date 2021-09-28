use anchor_lang::prelude::*;

use anchor_lang::solana_program::{
    account_info::AccountInfo, entrypoint::ProgramResult, msg, program::invoke,
    program_error::ProgramError, pubkey::Pubkey, system_instruction, system_program,
};
use candy_machine::{CandyMachine, Config};

declare_id!("HARm9wjX7iJ1eqQCckXdd1imRFXE6PsVChVdV4PbfLc");

pub struct BuyData<'info> {
    pub buyer: AccountInfo<'info>,
    pub seller: AccountInfo<'info>,
    system_program: AccountInfo<'info>,
}

pub fn buy_offset(project: &mut Account<Project>, amount: u64, data: &BuyData) -> ProgramResult {
    msg!("Buying {} offsets", amount);
    if amount > project.available_offset {
        return Err(ErrorCode::NotEnoughOffsetAvailable.into());
    }

    if project.authority != *data.seller.key {
        return Err(ErrorCode::SellerIsNotAuthority.into());
    }

    // transfer lamports
    let cost = project.offset_price * amount;
    msg!("Transfering {} lamports to seller", cost);
    invoke(
        &system_instruction::transfer(&data.buyer.key, &data.seller.key, cost),
        &[
            data.buyer.clone(),
            data.seller.clone(),
            data.system_program.clone(),
        ],
    )?;

    // consume offsets
    project.available_offset = project.available_offset - amount;

    Ok(())
}

#[program]
pub mod harmonia {

    use candy_machine::{MintOne, Ping};

    use super::*;

    pub fn create(ctx: Context<Create>, offsets: u64, price: u64, name: String) -> ProgramResult {
        msg!("Creating project");
        let project = &mut ctx.accounts.project;
        project.authority = *ctx.accounts.seller.key;
        project.available_offset = offsets;
        project.total_offset = offsets;
        project.offset_price = price;
        project.name = name;

        Ok(())
    }

    pub fn buy(ctx: Context<Buy>, amount: u64) -> ProgramResult {
        msg!("Direct buying {} offsets", amount);

        let buy_data = BuyData {
            buyer: ctx.accounts.buyer.clone(),
            seller: ctx.accounts.seller.clone(),
            system_program: ctx.accounts.system_program.clone(),
        };

        buy_offset(&mut ctx.accounts.project, amount, &buy_data)?;

        Ok(())
    }

    pub fn buy_and_mint(ctx: Context<BuyAndMintNFT>, amount: u64) -> ProgramResult {
        msg!("Buying {} and mint 1", amount);

        let buy_data = BuyData {
            buyer: ctx.accounts.buyer.clone(),
            seller: ctx.accounts.seller.clone(),
            system_program: ctx.accounts.system_program.clone(),
        };

        buy_offset(&mut ctx.accounts.project, amount, &buy_data)?;

        msg!("Ready to nft");
        let cpi_program = ctx.accounts.candy_program.to_account_info();
        let cpi_accounts = MintOne {
            config: ProgramAccount::try_from(cpi_program.key, &ctx.accounts.config).unwrap(),
            candy_machine: ProgramAccount::try_from(cpi_program.key, &ctx.accounts.candy_machine)
                .unwrap(),
            payer: ctx.accounts.payer.clone(),
            wallet: ctx.accounts.wallet.clone(),
            associated_token: ctx.accounts.associated_token.clone(),
            metadata: ctx.accounts.metadata.clone(),
            mint: ctx.accounts.mint.clone(),
            master_edition: ctx.accounts.master_edition.clone(),
            token_metadata_program: ctx.accounts.token_metadata_program.clone(),
            ata_program: ctx.accounts.ata_program.clone(),
            token_program: ctx.accounts.token_program.clone(),
            system_program: ctx.accounts.system_program.clone(),
            rent: ctx.accounts.rent.clone(),
            clock: ctx.accounts.clock.clone(),
        };
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        candy_machine::cpi::mint_one(cpi_ctx)?;

        // msg!("Ready to ping");
        // let cpi_program2 = ctx.accounts.candy_program.to_account_info();
        // let cpi_accounts2 = Ping {
        //     candy_machine: ProgramAccount::try_from(cpi_program2.key, &ctx.accounts.candy_machine).unwrap(),
        //     //candy_machine: ctx.accounts.candy_machine.try_from(),
        //     // authority: ctx.accounts.seller.clone(),
        // };
        // let cpi_ctx = CpiContext::new(cpi_program2, cpi_accounts2);
        // candy_machine::cpi::ping(cpi_ctx, 2)?;

        // msg!("==== end ping");

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Create<'info> {
    #[account(init, payer = seller, space = Project::LEN)]
    pub project: Account<'info, Project>,
    #[account(mut, signer)]
    pub seller: AccountInfo<'info>,
    #[account(address = system_program::ID)]
    system_program: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct Buy<'info> {
    #[account(mut)]
    pub project: Account<'info, Project>,
    #[account(mut, signer)]
    pub buyer: AccountInfo<'info>,
    #[account(mut)]
    pub seller: AccountInfo<'info>,
    #[account(address = system_program::ID)]
    system_program: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct BuyAndMintNFT<'info> {
    #[account(mut)]
    pub project: Account<'info, Project>,
    #[account(mut, signer)]
    pub buyer: AccountInfo<'info>,
    #[account(mut)]
    pub seller: AccountInfo<'info>,
    #[account(executable)]
    pub candy_program: AccountInfo<'info>,

    config: AccountInfo<'info>,
    #[account(mut)]
    candy_machine: AccountInfo<'info>,
    #[account(mut, signer)]
    payer: AccountInfo<'info>,
    #[account(mut)]
    wallet: AccountInfo<'info>,
    #[account(mut)]
    associated_token: AccountInfo<'info>,
    #[account(mut)]
    metadata: AccountInfo<'info>,
    #[account(mut, signer)]
    mint: AccountInfo<'info>,
    #[account(mut)]
    master_edition: AccountInfo<'info>,
    #[account(address = spl_token_metadata::id())]
    token_metadata_program: AccountInfo<'info>,
    #[account(address = spl_associated_token_account::id())]
    ata_program: AccountInfo<'info>,
    #[account(address = spl_token::id())]
    token_program: AccountInfo<'info>,
    #[account(address = system_program::ID)]
    system_program: AccountInfo<'info>,
    rent: Sysvar<'info, Rent>,
    clock: Sysvar<'info, Clock>,
}

#[account]
pub struct Project {
    pub authority: Pubkey,
    pub available_offset: u64,
    pub total_offset: u64,
    pub offset_price: u64,
    pub name: String,
}

impl Project {
    pub const LEN: usize = 32 + 8 + 8 + 8 + 100 + (8);
}

#[error]
pub enum ErrorCode {
    #[msg("Not enough offset available")]
    NotEnoughOffsetAvailable,
    #[msg("Can only send lamports to project authority")]
    SellerIsNotAuthority,
}
