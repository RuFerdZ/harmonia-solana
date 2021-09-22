use anchor_lang::prelude::*;

// use anchor_spl::token::{self, TokenAccount, Transfer};

use anchor_lang::solana_program::{
    account_info::AccountInfo, entrypoint::ProgramResult, msg, program::invoke,
    program_error::ProgramError, pubkey::Pubkey, system_instruction, system_program,
    sysvar::Sysvar,
};

declare_id!("5urSProYo2jCcyEid4Ytv3wE8fQbQRPV3UUPj7Hmac1u");

#[program]
pub mod harmonia {

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
        msg!("Buying {} offsets", amount);

        let project = &mut ctx.accounts.project;

        if amount > project.available_offset {
            return Err(ErrorCode::NotEnoughOffsetAvailable.into());
        }

        if project.authority != *ctx.accounts.seller.key {
            return Err(ErrorCode::SellerIsNotAuthority.into());
        }

        // transfer lamports
        let cost = project.offset_price * amount;
        msg!("Transfering {} lamports to seller", cost);
        invoke(
            &system_instruction::transfer(&ctx.accounts.buyer.key, &ctx.accounts.seller.key, cost),
            &[
                ctx.accounts.buyer.clone(),
                ctx.accounts.seller.clone(),
                ctx.accounts.system_program.clone(),
            ],
        )?;

        // consume offsets
        project.available_offset = project.available_offset - amount;

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
