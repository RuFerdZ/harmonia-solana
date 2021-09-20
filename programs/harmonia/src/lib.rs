use anchor_lang::prelude::*;

declare_id!("5urSProYo2jCcyEid4Ytv3wE8fQbQRPV3UUPj7Hmac1u");

#[program]
pub mod harmonia {
    use super::*;
    pub fn initialize(ctx: Context<Initialize>) -> ProgramResult {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
