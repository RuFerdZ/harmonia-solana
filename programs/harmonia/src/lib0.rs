// use anchor_lang::prelude::*;

// // use anchor_spl::token::{self, TokenAccount, Transfer};

// use anchor_lang::solana_program::{
//     account_info::AccountInfo, entrypoint::ProgramResult, msg, native_token::sol_to_lamports,
//     program::invoke, program_error::ProgramError, pubkey::Pubkey, system_instruction,
//     system_program, sysvar::Sysvar,
// };
// use std::str::FromStr;

// declare_id!("5urSProYo2jCcyEid4Ytv3wE8fQbQRPV3UUPj7Hmac1u");

// #[program]
// pub mod harmonia {

//     use super::*;

//     pub fn create(ctx: Context<Create>, name: String) -> ProgramResult {
//         // Set project name
//         msg!("Creating project");
//         let project = &mut ctx.accounts.project;
//         project.name = name;

//         // TODO setter to harmonia wallet
//         msg!("Checking harmonia wallet");
//         let harmonia_wallet = Pubkey::from_str("6hsYczsshZKdgzxWvPcqr9K82jJ6MuYUrmd24LB1yFch")
//             .expect("Err reading harmonia pubkey");
//         if *ctx.accounts.harmonia.key != harmonia_wallet {
//             return Err(ErrorCode::WrongHarmoniaWallet.into());
//         }

//         // TODO setter to project creation fee
//         msg!("Checking fees");
//         let fee: u64 = sol_to_lamports(1.0);
//         if ctx.accounts.seller.lamports() < fee {
//             return Err(ErrorCode::NotEnoughSOL.into());
//         }

//         msg!("Transfering {} to {}", fee, harmonia_wallet);
//         invoke(
//             &system_instruction::transfer(
//                 &ctx.accounts.seller.key,
//                 &ctx.accounts.harmonia.key,
//                 fee,
//             ),
//             &[
//                 ctx.accounts.seller.clone(),
//                 ctx.accounts.harmonia.clone(),
//                 ctx.accounts.system_program.clone(),
//             ],
//         )?;

//         Ok(())
//     }

//     pub fn buy(ctx: Context<Buy>, amount: u64) -> ProgramResult {
//         // Set project name
//         msg!("Buying offset for {} SOL", amount);

//         // let project = &mut ctx.accounts.project;

//         // TODO setter to harmonia wallet
//         msg!("Checking harmonia wallet");
//         let harmonia_wallet = Pubkey::from_str("6hsYczsshZKdgzxWvPcqr9K82jJ6MuYUrmd24LB1yFch")
//             .expect("Err reading harmonia pubkey");
//         if *ctx.accounts.harmonia.key != harmonia_wallet {
//             return Err(ErrorCode::WrongHarmoniaWallet.into());
//         }

//         let harmonia_fee = amount * 5 / 100; // take 5%
//         let rest = amount - harmonia_fee;

//         msg!(
//             "Transfering {} to harmonia({})",
//             harmonia_fee,
//             harmonia_wallet
//         );
//         invoke(
//             &system_instruction::transfer(
//                 &ctx.accounts.buyer.key,
//                 &ctx.accounts.harmonia.key,
//                 harmonia_fee,
//             ),
//             &[
//                 ctx.accounts.buyer.clone(),
//                 ctx.accounts.harmonia.clone(),
//                 ctx.accounts.system_program.clone(),
//             ],
//         )?;

//         msg!("Transfering {} to project account", rest);
//         invoke(
//             &system_instruction::transfer(
//                 &ctx.accounts.buyer.key,
//                 &ctx.accounts.harmonia.key,
//                 harmonia_fee,
//             ),
//             &[
//                 ctx.accounts.buyer.clone(),
//                 ctx.accounts.harmonia.clone(),
//                 ctx.accounts.system_program.clone(),
//             ],
//         )?;

//         Ok(())
//     }
// }

// #[derive(Accounts)]
// pub struct Create<'info> {
//     #[account(init, payer = seller, space = 8 + 100)]
//     pub project: Account<'info, Project>,
//     #[account(mut, signer)]
//     pub seller: AccountInfo<'info>,
//     #[account(mut)]
//     pub harmonia: AccountInfo<'info>,
//     #[account(address = system_program::ID)]
//     system_program: AccountInfo<'info>,
// }

// #[derive(Accounts)]
// pub struct Buy<'info> {
//     #[account(mut)]
//     pub project: Account<'info, Project>,
//     #[account(mut, signer)]
//     pub buyer: AccountInfo<'info>,
//     #[account(mut)]
//     pub harmonia: AccountInfo<'info>,
//     #[account(address = system_program::ID)]
//     system_program: AccountInfo<'info>,
// }

// #[account]
// pub struct Project {
//     pub name: String,
// }

// #[error]
// pub enum ErrorCode {
//     #[msg("Not enough SOL to create project")]
//     NotEnoughSOL,
//     #[msg("Wrong harmonia wallet")]
//     WrongHarmoniaWallet,
// }
