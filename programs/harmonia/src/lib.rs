use anchor_lang::prelude::*;

// use anchor_spl::token::{self, TokenAccount, Transfer};

use anchor_lang::solana_program::{
    account_info::AccountInfo, entrypoint::ProgramResult, msg, native_token::sol_to_lamports,
    program::invoke, program_error::ProgramError, pubkey::Pubkey, system_instruction,
    system_program, sysvar::Sysvar,
};
use std::str::FromStr;

declare_id!("5urSProYo2jCcyEid4Ytv3wE8fQbQRPV3UUPj7Hmac1u");

#[program]
pub mod harmonia {

    use super::*;

    pub fn create(ctx: Context<Create>, name: String) -> ProgramResult {
        // Set project name
        msg!("Creating project");
        let project = &mut ctx.accounts.project;
        project.name = name;

        // TODO setter to harmonia wallet
        msg!("Checking harmonia wallet");
        let harmonia_wallet = Pubkey::from_str("6hsYczsshZKdgzxWvPcqr9K82jJ6MuYUrmd24LB1yFch")
            .expect("Err reading harmonia pubkey");
        if *ctx.accounts.harmonia.key != harmonia_wallet {
            return Err(ErrorCode::WrongHarmoniaWallet.into());
        }

        // TODO setter to project creation fee
        msg!("Checking fees");
        let fee: u64 = sol_to_lamports(1.0);
        if ctx.accounts.payer.lamports() < fee {
            return Err(ErrorCode::NotEnoughSOL.into());
        }

        //         Hello, I am continuing my quest on learning solana and how to develop programs on it, I got the memo working yesterday thanks to you tridot, so thanks a lot for your help. Today, I am trying to write a program that when called does a transaction from (account to account). To do so, I am sending account, account2, and TOKEN_PROGRAM_ID to my program) having account1 as the signer. I thought then it would be a simple as this:
        // let transferIx = spl_token::instruction::transfer(tokenAcc.key, account.key, account2.key, account.key,&[account.key], 3)?;
        // invoke(&transferIx, &[account.clone(), account2.clone(), tokenAcc.clone()]);
        // To create the transfer but I keep getting an "invalid account data for instruction" error. any ideas?

        msg!("Transfering {} to {}", fee, harmonia_wallet);
        invoke(
            &system_instruction::transfer(&ctx.accounts.payer.key, &ctx.accounts.harmonia.key, fee),
            &[
                ctx.accounts.payer.clone(),
                ctx.accounts.harmonia.clone(),
                ctx.accounts.system_program.clone(),
            ],
        )?;

        // Creation fees
        // let cpi_accounts = Transfer {
        //     from: ctx.accounts.user.to_account_info().clone(),
        //     to: ctx.accounts.vault.to_account_info().clone(),
        //     authority: ctx.accounts.owner.clone(),
        // };
        // let cpi_program = ctx.accounts.token_program.clone();
        // let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        // token::transfer(cpi_ctx, amount)?;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Create<'info> {
    #[account(init, payer = payer, space = 8 + 100)]
    pub project: Account<'info, Project>,
    #[account(mut, signer)]
    pub payer: AccountInfo<'info>,
    #[account(mut)]
    pub harmonia: AccountInfo<'info>,
    #[account(address = system_program::ID)]
    system_program: AccountInfo<'info>,
}

#[account]
pub struct Project {
    pub name: String,
}

#[error]
pub enum ErrorCode {
    #[msg("Not enough SOL to create project")]
    NotEnoughSOL,
    #[msg("Wrong harmonia wallet")]
    WrongHarmoniaWallet,
}
