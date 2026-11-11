//! Gbam gift escrow.
//!
//! A sender locks USDC for "whoever holds the link". The link carries a throwaway ed25519 key;
//! only its PUBLIC key is stored here. To claim, the receiver's device signs their own address
//! with that key, so the money can only go to the address the link holder chose (no front-running).
//! After the window passes, only the sender can take the money back.
//!
//! Compared to classic claimable balances this needs no throwaway Stellar account per gift
//! and works for any address type (G… accounts today, C… smart wallets later).
#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error, token, xdr::ToXdr, Address,
    BytesN, Env,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Gift {
    pub sender: Address,
    pub amount: i128,
    pub expires_at: u64,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Token,
    Gift(BytesN<32>),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyExists = 1,
    NotFound = 2,
    Expired = 3,
    NotExpired = 4,
    BadAmount = 5,
    BadWindow = 6,
}

#[contractevent]
pub struct Created {
    #[topic]
    pub link: BytesN<32>,
    pub amount: i128,
}

#[contractevent]
pub struct Claimed {
    #[topic]
    pub link: BytesN<32>,
    pub to: Address,
    pub amount: i128,
}

#[contractevent]
pub struct Refunded {
    #[topic]
    pub link: BytesN<32>,
    pub amount: i128,
}

const DAY_LEDGERS: u32 = 17_280; // ~5s ledgers
const MAX_WINDOW_SECS: u64 = 30 * 24 * 60 * 60;

#[contract]
pub struct GiftEscrow;

#[contractimpl]
impl GiftEscrow {
    /// `token` is the Stellar Asset Contract of the asset gifts are paid in (test USDC).
    pub fn __constructor(env: Env, token: Address) {
        env.storage().instance().set(&DataKey::Token, &token);
    }

    pub fn token(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Token).unwrap()
    }

    /// Lock `amount` for the holder of `link`. Returns the unix time after which the sender can refund.
    pub fn create(env: Env, sender: Address, link: BytesN<32>, amount: i128, window: u64) -> u64 {
        sender.require_auth();
        if amount <= 0 {
            panic_with_error!(&env, Error::BadAmount);
        }
        if window == 0 || window > MAX_WINDOW_SECS {
            panic_with_error!(&env, Error::BadWindow);
        }
        let key = DataKey::Gift(link.clone());
        if env.storage().persistent().has(&key) {
            panic_with_error!(&env, Error::AlreadyExists);
        }

        let expires_at = env.ledger().timestamp() + window;
        token::Client::new(&env, &Self::token(env.clone())).transfer(&sender, &env.current_contract_address(), &amount);

        env.storage().persistent().set(&key, &Gift { sender, amount, expires_at });
        // Keep the gift alive past its window, so a late refund always finds it.
        let ledgers = (window / 5) as u32 + 7 * DAY_LEDGERS;
        env.storage().persistent().extend_ttl(&key, ledgers, ledgers);
        env.storage().instance().extend_ttl(30 * DAY_LEDGERS, 30 * DAY_LEDGERS);

        Created { link, amount }.publish(&env);
        expires_at
    }

    /// Claim to `to`. `sig` = link key's ed25519 signature over the XDR of `to` (ScVal::Address).
    /// Anyone may submit it (e.g. the app's fee sponsor); the signature is what authorizes it.
    pub fn claim(env: Env, link: BytesN<32>, to: Address, sig: BytesN<64>) -> i128 {
        let key = DataKey::Gift(link.clone());
        let gift: Gift = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| panic_with_error!(&env, Error::NotFound));
        if env.ledger().timestamp() >= gift.expires_at {
            panic_with_error!(&env, Error::Expired);
        }
        let msg = to.clone().to_xdr(&env);
        env.crypto().ed25519_verify(&link, &msg, &sig); // traps on a bad signature

        env.storage().persistent().remove(&key);
        token::Client::new(&env, &Self::token(env.clone())).transfer(&env.current_contract_address(), &to, &gift.amount);
        Claimed { link, to, amount: gift.amount }.publish(&env);
        gift.amount
    }

    /// After the window, the sender takes the money back.
    pub fn refund(env: Env, link: BytesN<32>) -> i128 {
        let key = DataKey::Gift(link.clone());
        let gift: Gift = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| panic_with_error!(&env, Error::NotFound));
        gift.sender.require_auth();
        if env.ledger().timestamp() < gift.expires_at {
            panic_with_error!(&env, Error::NotExpired);
        }
        env.storage().persistent().remove(&key);
        token::Client::new(&env, &Self::token(env.clone())).transfer(
            &env.current_contract_address(),
            &gift.sender,
            &gift.amount,
        );
        Refunded { link, amount: gift.amount }.publish(&env);
        gift.amount
    }

    pub fn get(env: Env, link: BytesN<32>) -> Option<Gift> {
        env.storage().persistent().get(&DataKey::Gift(link))
    }
}

#[cfg(test)]
mod test;
